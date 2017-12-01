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


require("http").globalAgent.maxSockets = Infinity;

const logger = log4js.getLogger();
logger.level = 'debug';

class Spider {

    constructor() {
        this.concurrency = {concurrency: 20};
        this.pageList    = [];
        this.db          = '';
        this.storeFile   = './data/db.csv';
        this.header      = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36'};
        this.init();
    }

    init() {
        const schema = {
            meta    : {
                name     : 'spider',
                number   : 0,
                startTime: '',
                endTime  : ''
            },
            list    : [
                {
                    name: '',
                    src : ''
                }
            ],
            holeList: []
        };

        this.db = low(adapter);
        this.db.defaults(schema).write();
    }

    // 10205
    urlList() {
        let result  = [];
        let baseUrl = 'http://www.cnnvd.org.cn/web/vulnerability/querylist.tag?pageno=';
        for (let i = 1; i < 10205; i++) {
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
                    res.end();
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
                logger.info(`finish curl ${page.src}...`);
                this.parseHolePage(response)
                resolve()
            } catch (err) {
                reject(err)
            }
        })
    }

    parseHolePage(html) {
        let $            = cheerio.load(html);
        // 标题
        let title        = $('body > div.container.m_t_10 > div > div.fl.w770 > div.detail_xq.w770 > h2').text();
        // cnnvdId
        let cnnvdId      = $('body > div.container.m_t_10 > div > div.fl.w770 > div.detail_xq.w770 > ul > li:nth-child(1) > span').text();
        // cveId
        let cveId        = $('body > div.container.m_t_10 > div > div.fl.w770 > div.detail_xq.w770 > ul > li:nth-child(3) > a').text();
        // 发布时间
        let publishTime  = $('body > div.container.m_t_10 > div > div.fl.w770 > div.detail_xq.w770 > ul > li:nth-child(5) > a').text();
        // 更新时间
        let updateTime   = $('body > div.container.m_t_10 > div > div.fl.w770 > div.detail_xq.w770 > ul > li:nth-child(7) > a').text();
        // 危害等级
        let vulLevel     = $('body > div.container.m_t_10 > div > div.fl.w770 > div.detail_xq.w770 > ul > li:nth-child(2) > a').text();
        // 漏洞类型
        let holeType     = $('body > div.container.m_t_10 > div > div.fl.w770 > div.detail_xq.w770 > ul > li:nth-child(4) > a').text();
        // 威胁类型
        let vulType      = $('body > div.container.m_t_10 > div > div.fl.w770 > div.detail_xq.w770 > ul > li:nth-child(6) > a').text();
        // 厂商
        let manufacturer = $('body > div.container.m_t_10 > div > div.fl.w770 > div.detail_xq.w770 > ul > li:nth-child(6) > a').text();
        // 漏洞来源
        let source       = $('#1 > a').text();

        // 漏洞简介
        let desc   = $('body > div.container.m_t_10 > div > div.fl.w770 > div:nth-child(3)').text();
        // 公告
        let notice = $('body > div.container.m_t_10 > div > div.fl.w770 > div:nth-child(4)').text();
        // 参考
        let ref    = $('body > div.container.m_t_10 > div > div.fl.w770 > div:nth-child(5)').text();
        // 影响实体
        let entity = $('body > div.container.m_t_10 > div > div.fl.w770 > div:nth-child(6) > div.vulnerability_list').text();
        // bugFix
        let bugFix = $('#pat > p').text();

        let capsule = {
            title,
            cnnvdId,
            cveId,
            publishTime,
            updateTime,
            vulLevel,
            holeType,
            vulType,
            manufacturer,
            source,
            desc,
            notice,
            ref,
            entity,
            bugFix,
        };

        this.db.get('holeList').push(capsule).write()
    }


    parseList(page) {
        return new Promise(async (resolve, reject) => {
            logger.info(`start curl ${page}...`);
            try {
                let response = await Spider.curl(page);
                logger.info(`finish curl ${page}...`);
                this.parseListUrl(response)
                resolve()
            } catch (err) {
                reject(err)
            }
        })
    }

    parseListUrl(html) {
        let $           = cheerio.load(html);
        let nameList    = $('body > div.container.m_t_10 > div > div.fl.w770 > div > div.list_list > ul li p a');
        let imageLength = nameList.length;


        for (let i = 0; i < imageLength; i++) {
            let atom = {
                name: $(nameList[i]).text(),
                src : "http://www.cnnvd.org.cn/" + $(nameList[i]).attr('href')
            };
            this.pageList.push(atom);
            this.db.get('list').push(atom).write();
        }
    }


    async getAllUrl() {
        return Promise.map(this.urlList(), (page) => {
            return this.parseList(page)
        }, this.concurrency)
    }


    async getAllHole() {
        return Promise.map(this.pageList, (page) => {
            return this.parseHole(page)
        }, this.concurrency)
    }

    async run() {
        try {
            logger.info(`get all the hole link start when ${(new Date())}`);
            this.db.set('meta.startTime', (new Date())).write();
            await this.getAllUrl();
            logger.info(`get all the hole link start when ${(new Date())}`);
            await this.getAllHole();
            this.db.set('meta.endTime', (new Date())).write();
        } catch (err) {
            logger.error(err)
        }
    }
}

(new Spider()).run();
