const axios = require("axios")
const {JWT, JWKS, JWK} = require("jose")
const uuid = require("uuid")
const moment = require("moment")
const express = require("express")
const EventEmitter = require('events');
const bodyParser = require("body-parser");
const urljoin = require("url-join")
const { getIpAddress } = require("./getip.js")
const { updateIpAddress } = require("./updateip.js")
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL || "5") // seconds
const CHECK_TIMEOUT = parseInt(process.env.CHECK_TIMEOUT || "10") // seconds - must be less than CHECK_INTERVAL
const PROPAGATAION_DELAY = parseInt(process.env.PROPAGATAION_DELAY || "120") // seconds

const RECEIVER_PORT = parseInt(process.env.RECEIVER_PORT || "3000")
const SELF_URI = process.env.SELF_URI || `http://localhost:${RECEIVER_PORT}`

const jwk = JWK.generateSync("EC","P-384");

const app = express()
const port = RECEIVER_PORT

const pingReceiver = new EventEmitter()

app.post('/', bodyParser.text({type:'application/jwt'}), (req, res) => {
    console.log('Receiving ping',moment().toISOString())
    let jwt = req.body
    try {
        let payload = JWT.verify(jwt,jwk)
        if (typeof payload.uuid !== 'string') res.status(406).json("JWT does not contain uuid")
        pingReceiver.emit('uuid',payload.uuid)        
    } catch (err) {
        res.status(406).json("Body is not a valid JWT")
    }
})

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))

const CheckLoop = async () => {

    let payload = {
        uuid: uuid.v4()
    }
    let jwt = JWT.sign(payload,jwk)

    let pingListener;

    try {

        let pingPromise = new Promise((resolve,reject) => {

            // wait for the signed response
            pingListener = (receivedUuid) => {
                console.debug(`Received uuid ${receivedUuid}`)
                console.debug(`Expected uuid ${payload.uuid}`)
                if (receivedUuid == payload.uuid) resolve()
            }
            pingReceiver.addListener('uuid',pingListener,resolve)
            // start the timer
            setTimeout(() => reject("Pong timed out"),CHECK_TIMEOUT*1000)

            // make the request
            console.debug(`Sending uuid ${payload.uuid}`)
            const pingRequestOptions = {
                method: "post",
                headers: {
                    'content-type':'application/jwt'
                },
                url: urljoin(SELF_URI,'/'),
                data: jwt
            };
            axios.request(pingRequestOptions).catch((err) => {
                console.error(err)
                reject(err)
            })

        })

        await pingPromise;
        console.debug(`Valid ping received. Polling again in ${CHECK_INTERVAL} seconds`)
    } catch (e) {
        console.warn("Did not receive self ping",e,moment())
        try {
            let newIp = await getIpAddress()
            console.log(`New IP address ${newIp}`)
            
            await updateIpAddress(newIp)

            // wait for propagation
            console.log(`Waiting ${PROPAGATAION_DELAY} seconds for propagation`)
            await new Promise(resolve => setTimeout(resolve,PROPAGATAION_DELAY*1000))
        } catch(err) {
            console.warn("Could not update IP address",err,moment())
        }
    } finally {
        pingReceiver.removeListener('uuid',pingListener)
    }

    setTimeout(CheckLoop,CHECK_INTERVAL*1000)
}

CheckLoop()