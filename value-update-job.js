const schedule = require("node-schedule")
const request = require("request")
let mysql = require("mysql")
let cheerio = require('cheerio')

var con = mysql.createConnection({
    host: "192.168.2.35",
    user: "crypto",
    password: "CryptoStonks",
    database: "portfoliotracker"
});

con.connect((err) => { if (err) throw err })

var cb;

function Schedule(callback) {
    cb = callback
    // Update all market values in the database every minute.
    const job = schedule.scheduleJob("*/1 * * * *", UpdateMarketValues)
}

function UpdateMarketValues() {
    let date = new Date().toISOString().slice(0, 19).replace('T', ' ')
    console.log(`${date} - fetching market data`)

    con.query("SELECT * FROM markets;", (qerr, res) => {
        if (qerr) throw qerr

        res.forEach(market => {
            UpdateMarket(market, date, cb)
        });
    })
}

function UpdateMarket(market, date) {
    let MD = {
        DateTime: date,
        MarketType: market.MarketType,
        MarketAbbr: market.MarketAbbr
    }

    //First, get the new value for the market
    if (market.MarketType == "crypto") {
        request(`https://api.litebit.eu/market/${market.MarketAbbr}`, (reqErr, res, body) => {
            if (reqErr) throw reqErr

            let rawMD = JSON.parse(body)
                
            MD.CurrencyAbbr = "EUR";
            MD.Value = rawMD.result.sell;

            InsertMD(MD)
        })
    }
    else if (market.MarketType == "fund") {
        if (date.slice(14, 16) == "00") {
            request(`https://www.fundsquare.net/Fundsquare/application/vni/${market.MarketAbbr}`, (reqErr, res, body) => {
                if (reqErr) throw reqErr

                let rawMD = JSON.parse(body)

                MD.CurrencyAbbr = "EUR";
                MD.Value = rawMD.EUR[0].pxSous;

                InsertMD(MD)
            })
        }
    }
    else if (market.MarketType == "stock") {
        if (date.slice(14, 16) == "00") {
            request(`https://finance.yahoo.com/quote/${market.MarketAbbr}?p=${market.MarketAbbr}`, (reqErr, res, body) => {
                if (reqErr) throw reqErr
                const $ = cheerio.load(body.toString())
                let val = $(`.Fw\\(b\\).Fz\\(36px\\).Mb\\(-4px\\).D\\(ib\\)`, body)['0'].children[0].data

                MD.CurrencyAbbr = "EUR";
                MD.Value = val;

                InsertMD(MD)
            })
        }
    }
    else {
        throw new Error("No valid market type found")
    }
}

function InsertMD(MD) {
    con.query(`
        INSERT INTO marketvalue
        VAlUES ('${MD.DateTime}', '${MD.MarketType}', '${MD.MarketAbbr}', '${MD.CurrencyAbbr}', '${MD.Value}')`,
        (err, res) => {
            if (err) throw err;

            cb(MD)
    })
}

module.exports = Schedule;