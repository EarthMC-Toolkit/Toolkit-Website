const emc = require("earthmc"), endpoint = emc.endpoint,
      modify = require("earthmc-dynmap-plus/index"),
      cache = require("memory-cache")
    
var { NextApiResponse, NextApiRequest } = require('next'),
    arg = index => args[index]?.toLowerCase() ?? null,
    args = []

/**
 * Handles how the response is served according to the map.
 * @param { NextApiRequest } req - The request object from the client.
 * @param { NextApiResponse } res - The response object to send, usually JSON.
 * @param { 'aurora' | 'nova' } map - The EarthMC map name to use. Defaults to 'aurora'.
 */
async function serve(req, res, mapName = 'aurora') {
    let { params } = req.query,
        map = mapName == 'nova' ? emc.Nova : emc.Aurora
        
    let out = req.method == 'POST' 
            ? await post(map, req, params)
            : await get(params, map)

    if (!out) return res.status(404).json('Error: Unknown or invalid request!')
    switch(out) {
        case 'no-auth': return res.status(403).json("Refused to send request, invalid auth key!")
        case 'cache-miss': return res.status(404).json('Data not cached yet, try again soon.')
        case 'fetch-error': return res.status(500).json('Error fetching data, please try again.')
        default: {
            if (typeof out == 'string' && out.includes('does not exist')) res.status(404).json(out)
            else {
                res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate=180')   
                res.status(200).json(out)
            }
        }
    }
}

const post = async (map, req, params) => {
    let authKey = req.headers['authorization'],
        data = req.body,
        [dataType] = params

    if (authKey != process.env.AUTH_KEY) return 'no-auth'
    if (!data || Object.keys(data).length < 1) return null

    switch(dataType) {
        case 'alliances': cache.put(`${map}_alliances`, data)
        case 'allplayers': {
            var allPlayers = await map.getAllPlayers().catch(() => {})
            if (!allPlayers) return 'fetch-error'

            const mergeByName = (a1, a2) => a1.map(itm => ({...a2.find(item => (item.name === itm.name) && item), ...itm}))
            data = mergeByName(allPlayers, req.body)

            cache.put(`${map}_players`, data)
        }
    }
    
    res.status(200).json(data)
}

const get = async (params, map) => {
    args = params.slice(1)

    const [dataType] = params,
          single = arg(0), filter = arg(1)

    switch(dataType.toLowerCase()) {
        case 'markers': {
            let aType = validParam(filter) ?? 'mega'
            return await modify(map == emc.Nova ? 'nova' : 'aurora', aType) ?? 'fetch-error'
        }
        case 'update': {
            let raw = await endpoint.playerData('aurora')
            if (raw?.updates) raw.updates = raw.updates.filter(e => e.msg != "areaupdated" && e.msg != "markerupdated") 
            else raw = 'fetch-error'

            return raw
        }
        case 'towns': {
            if (!single) return await map.getTowns()
            if (!filter) return await map.getTown(single)

            return validParam(filter) ?? await map.getJoinableNations(single)
        }
        case 'nations': {
            if (!single) return await map.getNations()
            if (!filter) return await map.getNation(single)

            return validParam(filter) ?? await map.getInvitableTowns(single, false)
        }
        case 'nearby': {
            if (args.length < 4) return 'Not enough arguments specified! Refer to the documentation.'

            let type = validParam(single)
            if (type) return type

            let inputs = [
                args[1], args[2], 
                args[3], args[4] ?? args[3] 
            ]

            if (single == 'players') return map.getNearbyPlayers(...inputs)
            if (single == 'towns') return map.getNearbyTowns(...inputs)
            if (single == 'nations') return map.getNearbyNations(...inputs)
        }
        case 'alliances': {
            let alliances = cache.get(`${map}_alliances`)
            if (!alliances) return 'cache-miss'

            return !single ? alliances : alliances.find(a => a.allianceName.toLowerCase() == single.toLowerCase())
        }
        case 'allplayers': {
            var cachedPlayers = cache.get(`${map}_players`)
            if (!cachedPlayers) return await map.getAllPlayers().catch(() => {})
            if (!single) return cachedPlayers

            var player = cachedPlayers.find(p => p.name.toLowerCase() == single.toLowerCase())
            return player ?? "That player does not exist!"
        }
        case 'residents': return single ? await map.getResident(single) : await map.getResidents()
        case 'onlineplayers': return single ? await map.getOnlinePlayer(single) : await map.getOnlinePlayers(true)
        default: return `Parameter ${dataType} not recognized.`
    }
}

const validParam = param => {
    let arr = ['invitable', 'joinable', 'towns', 'nations', 'players']
    return arr.includes(param) ? null : `Parameter ${param} not recognized.`
}

export default serve