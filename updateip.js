const axios = require("axios")
const urljoin = require("url-join")
const _ = require("lodash")

const CF_API_TOKEN = process.env.CF_API_TOKEN
const CF_API_BASE = "https://api.cloudflare.com/client/v4"
const CF_ZONE_ID = process.env.CF_ZONE_ID
const HOSTNAME_A_VALUE = process.env.HOSTNAME_A_VALUE

const verifyToken = async () => {
    let res = await axios.get(urljoin(CF_API_BASE,"user/tokens/verify"),{
        headers: {'Authorization': `Bearer ${CF_API_TOKEN}`},
        responseType:"json"
    });
    if (!(res.data.success && res.data.result.status == 'active')) throw 'Supplied token is not active'
}

const listZoneARecords = async () => {
    let res = await axios.get(urljoin(CF_API_BASE,"zones",CF_ZONE_ID,"dns_records"),{
        headers: {'Authorization': `Bearer ${CF_API_TOKEN}`},
        responseType:"json",
        params: {
            type: "A",
            name: HOSTNAME_A_VALUE
        }
    });
    if (!res.data.success) throw 'Zone Listing Error'
    //console.debug(res.data.result) // result: [{id:"..."}]
    return res.data.result
}

const deleteZoneARecord = async (recordId) => {

    console.debug(`Deleting record ${recordId}`)
    let res = await axios.request({
        method: "DELETE",
        url: urljoin(CF_API_BASE,"zones",CF_ZONE_ID,"dns_records",recordId),
        headers: {'Authorization': `Bearer ${CF_API_TOKEN}`},
        responseType:"json"
    });
    if (!res.data.success) throw 'Record Deletion Error'
}

const deleteZoneARecords = async (records) => {
    return Promise.all(_.map(records,r => deleteZoneARecord(r.id)))
}

const createARecord = async (newIpAddress) => {
    try {
        let res = await axios.request({
            method:"POST",
            url:urljoin(CF_API_BASE,"zones",CF_ZONE_ID,"dns_records"),
            headers: {'Authorization': `Bearer ${CF_API_TOKEN}`},
            responseType:"json",
            data: {
                type: "A",
                name: HOSTNAME_A_VALUE,
                content: newIpAddress,
                ttl: 120,
                proxied: false
            }
        });    
        if (!res.data.success) throw 'Zone Listing Error'
    } catch (err) {
        console.error(JSON.stringify(err.response.data.errors))
        throw err
    }
}


exports.updateIpAddress = async (newIpAddress) => {

    console.log(`Updating IP Address for ${HOSTNAME_A_VALUE} to ${newIpAddress}`)

    await verifyToken()
    .then(listZoneARecords)
    .then(deleteZoneARecords)
    .then(() => createARecord(newIpAddress))

    console.log(`Successfully changed IP Address for ${HOSTNAME_A_VALUE} to ${newIpAddress}`)

}