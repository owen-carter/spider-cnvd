'use strict';
const fs = require('fs');
const path = require('path');
const low = require('lowdb');
const log4js = require('log4js');
const cheerio = require('cheerio');
const request = require('request');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync(path.join(__dirname, 'data', 'db.json'));


const logger = log4js.getLogger();
logger.level = 'debug';

class Spider {

    constructor() {
        this.db = '';
        this.storeFile = './data/db.csv';
        this.header = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36'}
    }

    init() {
        const schema = {
            meta: {
                name: 'spider',
                number: 0,
                updatedTime: ''
            },
            images: [
                {
                    name: '',
                    src: ''
                }
            ]
        };

        this.db = low(adapter);
        this.db.defaults(schema).write();
    }

    * urlList() {
        let i;
        let baseUrl = 'http://www.meisupic.com/topic.php?topic_id=';
        for (i = 0; i, 100; i++) {
            yield (baseUrl + i)
        }
    }

    static curl(url) {
        let reqConfig = {
            url: url,
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

    static wget(fileName, filePath) {
        let reqConfig = {
            url: filePath,
            method: 'get',
            header: this.header
        };
        let stream = fs.createWriteStream('./images/' + fileName);
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
        let $ = cheerio.load(html);
        let hrefList = $('.album_page .glide .slide dl a');

        return (Array.from(hrefList)).map((ele) => {
            return 'http://www.meisupic.com/' + $(ele).attr('href')
        });
    }

    parseImage(html) {
        let $ = cheerio.load(html);
        let nameList = $('.ui_cover dl');
        let srcList = $('.imgList .imgItem a img');
        let imageLength = nameList.length;
        let imageList = [];

        for (let i = 0; i < imageLength; i++) {
            imageList.push({
                name: $(nameList[i]).attr('title'),
                src: $(srcList[i]).attr('data-original')
            })
        }

        return imageList;
    }

    async bootstrap() {
        for (let url of this.urlList()) {
            let listPage = await Spider.curl(url);
            logger.info(`get a page ${url}`);
            let pageUrlList = this.parseHtml(listPage);
            for (let src of pageUrlList) {
                let imagesPage = await Spider.curl(src);
                logger.info(`get a image page ${src}`);
                let imageEntityList = this.parseImage(imagesPage);
                for (let img of imageEntityList) {
                    await this.saveImageInfo(img);
                    await this.downImage(img);
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