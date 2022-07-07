const { Aurora } = require('earthmc')

const output = async data => {
    switch(data.toLowerCase()) {
        case 'towns': return await Aurora.getTowns()
        case 'nations': return await Aurora.getNations()
        case 'allplayers': return await Aurora.getAllPlayers()
        case 'residents': return await Aurora.getResidents()
        case 'townless': return await Aurora.getTownless()
        case 'onlineplayers': return await Aurora.getOnlinePlayers(true)
        default: return null
    }
}

async function handler(req, res) {
    const { data } = req.query
    if (!data) return res.status(404).send('Error: Data type not specified.')

    let out = await output(data)
    if (!out) return res.status(404).send(`Data parameter ${data} not recognized.`)

    res.status(200).json(out)
}

export {
    output,
    handler as default
}