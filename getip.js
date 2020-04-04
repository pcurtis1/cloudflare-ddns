const axios = require("axios")
exports.getIpAddress = async () => {
    console.debug("Getting IP Address")

    let url = process.env.IP_ADDRESS_API || "https://api.ipify.org/?format=json"

    let response = await axios.get(url,{
        responseType: "json"
    })

    if (!/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(response.data.ip)) throw 'Did not receive an IP address'

    return response.data.ip

}