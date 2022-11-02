const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { config } require("dotenv");
const cheerio = require("cheerio");
const rp = require("request-promise");
const { WebhookClient, EmbedBuilder } from 'discord.js'
const monk = require("monk");
const { customAlphabet } require("nanoid");
config()

const app = express()
app.use(cors())
app.use(morgan('dev'))

const nanoid = customAlphabet('0123456789', 17)

const { whid, whtoken } = process.env;
const wh = new WebhookClient(whid, whtoken)

const db = monk(process.env.MONGO_URI)

async function fetchData(username) {
    const { body } = await rp({ uri: `https://www.tiktok.com/@${username}`, json: true, resolveWithFullResponse: true, gzip: true, method: 'GET', followAllRedirects: false, headers: { 'cookie': { 'tt_webid_v2': `69${nanoid()}` }, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36' } })
    const $ = cheerio.load(body)
    const rawData = JSON.parse(await $('script').get().filter(a => a.attribs.id == "__NEXT_DATA__" ? true : false)[0].children[0].data)
    return rawData.props.pageProps;
}

async function sendEmbed(data, dataVideo) {
    const tiktokAvatar = data.userInfo.user.avatarLarger
    console.log(dataVideo.video)
    const embed = new EmbedBuilder({title: 'New video is up', color: 'Random', url: `${data.seoProps.metaParams.canonicalHref}/video/${dataVideo.id}`, description: dataVideo.desc}).setThumbnail(tiktokAvatar).setTimestamp().setImage(dataVideo.video.cover).setFields([{ name: 'Link:', value: `[Click here](${`${data.seoProps.metaParams.canonicalHref}/video/${dataVideo.id}`})`, inline: false }])
    wh.send('test', {
        embeds: [embed]
    })
}

async function checker(username, data) {
    const collection = db.get(username)
    const arrayofid = (data.items).map(e => e.id)
    const dataondb = await collection.find({})
    if(dataondb.length == 0) {
        collection.insert({ videoIds: arrayofid, username: username }).then(e => sendEmbed(data, data.items[0]))
    }
    else {
        let thereisnew;
        const booleanofarray = arrayofid.map(e => {
            return {
                id: e,
                new: !dataondb[0].videoIds.includes(e)
            }
        })
        booleanofarray.forEach(e => {
            if(e.new == true) {
                sendEmbed(data, data.items.filter(a => a.id == e.id)[0])
                thereisnew = true
            }
        });
        if(thereisnew) {
            collection.findOneAndUpdate({ username: username }, { $set: { videoIds: arrayofid } })
        }
    }
}

app.all('/', async(req, res) => {
    const { tiktokusername } = process.env;
    const data = await fetchData(tiktokusername)
    checker(tiktokusername, data).then(e => res.send('OK').status(200)).catch(err => console.error)
})


const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Runing at PORT ${PORT}`))
