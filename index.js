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

        this.concurrency = {concurrency: 50};

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

    * urlList() {
        let i;
        let baseUrl = 'http://www.cnnvd.org.cn/web/vulnerability/querylist.tag?pageno=';
        for (i = 0; i < 10205; i++) {
            yield (baseUrl + i + "&repairLd=")
        }
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
            } catch (err) {
                reject(err)
            }
        })
    }


    parseHtml(html) {
        let $           = cheerio.load(html);
        let nameList    = $('.list_list ul li #vulner_0 a');
        let imageLength = nameList.length;
        let imageList   = [];

        for (let i = 0; i < imageLength; i++) {
            imageList.push({
                name: $(nameList[i]).text(),
                src : "http://www.cnnvd.org.cn/" + $(nameList[i]).attr('href')
            })
        }

        return imageList;
    }

    parseHolePage(html) {
        let $     = cheerio.load(html);
        let title = $('body > div.container.m_t_10 > div > div.fl.w770 > div.detail_xq.w770 > h2').text();

        console.dir(title)

        return {
            title
        };
    }

    async getAllUrl() {
        let allPageUrlList = [];
        for (let url of this.urlList()) {
            let listPage = await Spider.curl(url);
            logger.info(`get a page ${url}`);
            let pageUrlList = this.parseHtml(listPage);
            for (let page in pageUrlList) {
                allPageUrlList.push(page.src)
                logger.info(allPageUrlList.length)
            }
        }
        return allPageUrlList;
    }


    async bootstrap(pageUrlList) {
        Promise.map(pageUrlList, (page) => {
            return this.parseHole(page)
        }, this.concurrency).then(() => {
            logger.info(`download ${pageUrlList.length} images`);
        });
    }

    async run() {
        let result = await this.getAllUrl();
        await this.bootstrap(result);
    }
}

(new Spider()).run();