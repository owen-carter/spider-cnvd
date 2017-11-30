'use strict';
const fs       = require('fs');
const path     = require('path');
const low      = require('lowdb');
const log4js   = require('log4js');
const cheerio  = require('cheerio');
const Promise  = require('bluebird');
const request  = require('request');
const FileSync = require('lowdb/adapters/FileSync');
const adapter  = new FileSync(path.join(__dirname, 'data', 'db.json'));


const logger = log4js.getLogger();
logger.level = 'debug';

class Spider {

    constructor() {

        this.concurrency = {concurrency: 30};

        this.pageList = [];

        this.db        = '';
        this.storeFile = './data/db.csv';
        this.header    = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36'}
    }

    init() {
        const schema = {
            meta  : {
                name       : 'spider',
                number     : 0,
                updatedTime: ''
            },
            images: [
                {
                    name: '',
                    src : ''
                }
            ]
        };

        this.db = low(adapter);
        this.db.defaults(schema).write();
    }

    urlList() {
        let result  = [];
        let baseUrl = 'http://www.cnnvd.org.cn/web/vulnerability/querylist.tag?pageno=';
        for (let i = 0; i < 10205; i++) {
            result.push(`${baseUrl}${i}&repairLd=`)
        }
        return result;
    }

    static curl(url) {
        let reqConfig = {
            url   : url,
            method: 'get',
            header: this.header
        };
        return new Promise((resolve, reject) => {
            request(reqConfig, (err, res, body) => {
                if (err) {
                    logger.error(`curl url err:${err}`);
                    reject(err);
                }
                resolve(body);
            })
        })
    }


    parseHole(page) {
        return new Promise(async (resolve, reject) => {
            logger.info(`start curl ${page.src}...`);
            try {
                let response = await Spider.curl(page.src);
                this.parseHolePage(response)
                resolve()
            } catch (err) {
                reject(err)
            }
        })
    }

    parseHolePage(html) {
        let $       = cheerio.load(html);
        let title   = $('body > div.container.m_t_10 > div > div.fl.w770 > div.detail_xq.w770 > h2').text();
        let cnnvdId = $('body > div.container.m_t_10 > div > div.fl.w770 > div.detail_xq.w770 > ul > li:nth-child(1) > span').text();
        let cveId = $('body > div.container.m_t_10 > div > div.fl.w770 > div.detail_xq.w770 > ul > li:nth-child(3) > a').text();

        let desc = $('body > div.container.m_t_10 > div > div.fl.w770 > div:nth-child(3)').text();
        let ref = $('body > div.container.m_t_10 > div > div.fl.w770 > div:nth-child(5)').text();

        console.dir(title);

        return {
            title
        };
    }


    parseList(page) {
        return new Promise(async (resolve, reject) => {
            logger.info(`start curl ${page}...`);
            try {
                let response = await Spider.curl(page);
                this.parseListUrl(response)
                resolve()
            } catch (err) {
                reject(err)
            }
        })
    }

    parseListUrl(html) {
        let $           = cheerio.load(html);
        let nameList    = $('.list_list ul li #vulner_0 a');
        let imageLength = nameList.length;


        for (let i = 0; i < imageLength; i++) {
            this.pageList.push({
                name: $(nameList[i]).text(),
                src : "http://www.cnnvd.org.cn/" + $(nameList[i]).attr('href')
            })
        }

    }


    async getAllUrl() {
        return Promise.map(this.urlList(), (page) => {
            return this.parseList(page)
        }, this.concurrency)
    }


    async bootstrap() {
        return Promise.map(this.pageList, (page) => {
            return this.parseHole(page)
        }, this.concurrency)
    }

    async run() {
        try {
            await this.getAllUrl();
        } catch (err) {
            logger.error(err)
        }
        // await this.bootstrap();
    }
}

(new Spider()).run();