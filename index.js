'use strict';
const fs       = require('fs');
const path     = require('path');
const low      = require('lowdb');
const log4js   = require('log4js');
const cheerio  = require('cheerio');
const request  = require('request');
const FileSync = require('lowdb/adapters/FileSync');
const adapter  = new FileSync(path.join(__dirname, 'data', 'db.json'));


const logger = log4js.getLogger();
logger.level = 'debug';

class Spider {

    constructor() {
        this.db        = '';
        this.storeFile = './data/db.csv';
        this.header    = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36'}
    }

    init() {
        const schema     = {
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
        this.catalogList = [
            {
                name  : "WEB应用漏洞",
                typeId: "29"
            },
            {
                name  : "安全产品漏洞",
                typeId: "32"
            },
            {
                name  : "应用程序漏洞",
                typeId: "28"
            },
            {
                name  : "操作系统漏洞",
                typeId: "27"
            },
            {
                name  : "数据库漏洞",
                typeId: "30"
            },
            {
                name  : "网络设备漏洞",
                typeId: "31"
            }
        ];
        this.db          = low(adapter);
        this.db.defaults(schema).write();
    }

    * genCatalogList() {
        let baseUrl = 'http://www.cnvd.org.cn/flaw/typeResult?typeId=';
        for (let catalog of this.catalogList) {
            yield (baseUrl + catalog['typeId']);
        }
    }

    * genUrlList(typeId, max) {
        let baseUrl = `http://www.cnvd.org.cn/flaw/typeResult?typeId=${typeId}&max=20&offset=60`;
        for (let i = 0; i, max; i++) {
            yield (baseUrl + i)
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

    static pipe(url) {
        let reqConfig = {
            url   : url,
            method: 'get',
            gzip  : true,
            header: this.header
        };
        let chunks    = [];
        let size      = 0;
        let result    = '';
        return new Promise((resolve, reject) => {
            request(reqConfig)
                .on('error', (err) => {
                    logger.error(`pipe file err: ${err}`);
                    reject(err)
                })
                .on('data', (chunk) => {
                    size += chunk.length;
                    chunks.push(chunk);
                })
                .on('end', () => {
                    result = Buffer.concat(chunks, size);
                    resolve(result.toString())
                });
        })
    }


    static wget(fileName, filePath) {
        let reqConfig = {
            url   : filePath,
            method: 'get',
            header: this.header
        };
        let stream    = fs.createWriteStream('./images/' + fileName);
        return new Promise((resolve, reject) => {
            request(reqConfig)
                .on('error', (err) => {
                    logger.error(`wget file err: ${err}`);
                    reject(err)
                })
                .pipe(stream)
                .on('close', () => {
                    resolve(void(0))
                });
        })
    }


    saveImageInfo(image) {
        return new Promise((resolve, reject) => {
            try {
                this.db.get('images')
                    .push({name: image.name, src: image.src})
                    .write();
                resolve(void(0))
            } catch (e) {
                logger.error(`save image info err: ${err}`);
                reject(e)
            }
        })
    }

    downImage(image) {
        return Spider.wget(image.name + '.jpg', image.src)
    }


    parseHtml(html) {
        let $        = cheerio.load(html);
        let hrefList = $('.album_page .glide .slide dl a');

        return (Array.from(hrefList)).map((ele) => {
            return 'http://www.meisupic.com/' + $(ele).attr('href')
        });
    }

    parseImage(html) {
        let $           = cheerio.load(html);
        let nameList    = $('.ui_cover dl');
        let srcList     = $('.imgList .imgItem a img');
        let imageLength = nameList.length;
        let imageList   = [];

        for (let i = 0; i < imageLength; i++) {
            imageList.push({
                name: $(nameList[i]).attr('title'),
                src : $(srcList[i]).attr('data-original')
            })
        }

        return imageList;
    }

    parseCatalogPage(html) {
        console.dir(html)
        let $              = cheerio.load(html);
        let pageComponents = $("#flawList > div > a");
        for (let page of (Array.from(pageComponents))) {
            console.dir($(page).attr('text'))
        }
        return '';
    }

    parseListPage(html) {

    }

    parseInfoPage(html) {

    }

    save() {

    }

    async bootstrap() {
        for (let url of this.genCatalogList()) {
            logger.info(`get a page from ${url}`);
            let catalogIndexPage = await Spider.pipe(url);
            console.dir(catalogIndexPage);
            let allPageNumber = this.parseCatalogPage(catalogIndexPage);
            for (let src of this.genUrlList(allPageNumber)) {
                let listPage = await Spider.curl(src);
                logger.info(`get a list page ${src}`);
                let urlList = this.parseListPage(listPage);
                for (let u of urlList) {
                    let infoPage = await Spider.curl(u)
                    let info     = this.parseInfoPage(infoPage);
                    this.save(info);
                    logger.info(`save and down the file(${img.name})`)
                }
            }
        }
    }

    run() {
        this.init();
        this.bootstrap();
    }
}

(new Spider()).run();