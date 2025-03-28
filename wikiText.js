import {parentPort} from "worker_threads"
import axios from "axios"
import * as cheerio from 'cheerio';
import {translate} from "google-translate-api-browser"
import {MongoClient,ObjectId} from "mongodb"
import {GoogleGenerativeAI} from "@google/generative-ai";
import dotenv from 'dotenv';
const client=new MongoClient("mongodb://apo:jac2001min@cluster0-shard-00-00.pdunp.mongodb.net:27017,cluster0-shard-00-01.pdunp.mongodb.net:27017,cluster0-shard-00-02.pdunp.mongodb.net:27017/?ssl=true&replicaSet=atlas-me2tz8-shard-0&authSource=admin&retryWrites=true&w=majority")
let db

parentPort.on("message",async(message)=>{
    if(message.type==="start"){
        let info=message.body
        if(info.id){
            client.connect().then(()=>{
                db=client.db("gita")
                db.collection("user").findOne({_id:new ObjectId(info.id)}).then(e=>{
                    if(!e.cronology){
                        db.collection("user").findOneAndUpdate({_id:new ObjectId(info.id)},{$push:{cronology:{nome:info.nome,lat:info.lat,lon:info.lon,img:info.img,data:info.data}}}).catch(err =>console.error(err))
                    }else{
                        if(e.cronology.length>0&&!e.cronology.find(i=>i.nome===info.nome)){
                            db.collection("user").findOneAndUpdate({_id:new ObjectId(info.id)},{$push:{cronology:{nome:info.nome,lat:info.lat,lon:info.lon,img:info.img,data:info.data}}}).catch(err =>console.error(err))
                        }
                    }
                })
            }).catch(err => {
                console.error("Failed to connect to the database:", err);
            });
        }
        if(info.wikidata){
            const response = await axios.get(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks/urls&ids=${info.wikidata}`);
            let lingua=info.lingua
            let obj=response.data.entities[Object.keys(response.data.entities)].sitelinks[lingua+"wiki"]
            if(!obj){
                obj=response.data.entities[Object.keys(response.data.entities)].sitelinks["enwiki"]
                lingua="en"
            }
            if(!obj){
                for(let x of Object.values(response.data.entities[Object.keys(response.data.entities)].sitelinks)){
                    if(!x.site.includes("commons"))lingua=x.site.split("wiki")[0];
                    obj=response.data.entities[Object.keys(response.data.entities)].sitelinks[lingua+"wiki"]
                }
            }
            if(obj){
                axios.get("https://"+lingua+".wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&redirects=true&titles="+obj.title).then(e=>{
                    if(e.data.query.pages[Object.keys(e.data.query.pages)].pageid){
                        text("https://"+lingua+".wikipedia.org/w/api.php?action=parse&prop=text&format=json&pageid="+e.data.query.pages[Object.keys(e.data.query.pages)].pageid,info.lingua,lingua).then(async i=>{
                            if(i.length>0){
                                parentPort.postMessage(i)                        
                            }else{
                                error(lingua)
                            }
                        })
                    }else{
                        error(info.lingua)
                    }
                })
            }else{
                error(info.lingua)
            }
        }else if(info.lat&&info.lon){
            axios.get("https://"+info.lingua+".wikipedia.org/w/api.php?action=query&format=json&list=geosearch&gscoord="+info.lat+"|"+info.lon+"&gsradius=1000&redirects=true&gssearch="+info.nome).then(e=>{
                if(e.data.query.geosearch[0]){
                    text("https://"+info.lingua+".wikipedia.org/w/api.php?action=parse&prop=text&format=json&pageid="+e.data.query.geosearch[0].pageid,info.lingua).then(async i=>{
                        if(i.length>0){
                            parentPort.postMessage(i)                        
                        }else{
                            error(lingua)
                        }
                    })
                }else{
                    error(info.lingua)
                }
            })
        }else{
            axios.get("https://"+info.lingua+".wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&redirects=true&titles="+info.nome).then(e=>{
                if(e.data.query.pages[Object.keys(e.data.query.pages)].pageid){
                    text("https://"+info.lingua+".wikipedia.org/w/api.php?action=parse&prop=text&format=json&pageid="+e.data.query.pages[Object.keys(e.data.query.pages)].pageid,info.lingua).then(async i=>{
                        if(i.length>0){
                            parentPort.postMessage(i)                        
                        }else{
                            error(lingua)
                        }
                    })
                }else{
                    error(info.lingua)
                }
            })
        }
    }
})
//funzione per gestire errori
const error=(lingua)=>{
    let titolo="Text"
    let testo="I can't find any information about it"
    let summary="I can't find any information about it"
    parentPort.postMessage({type:"error",error:[{titolo:titolo,testo:testo,riassunto:summary}]})
}
//funzione per ottenere il testo in base alla pagina da analizzare
const text=async (url,lingua,lingua2)=>{
    const array=[]
    await axios.get(url).then(async i=>{
        const img=[]
        cheerio.load(i.data.parse.text["*"])("img").map((i,n)=>{
            n.attribs.src.match(/\b\d{3}px\b/)&&img.push("https:"+n.attribs.src)
        })
        let testo=cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr p').text().replace("Altri progetti","").replace(/\[\d+\]/g, '')
        if(lingua!==lingua2){
            const sentences=testo.split(". ")
            let translated=""
            for(let sentence of sentences){
                try{
                    const translation=await translate(sentence, { to: lingua, corsUrl: "http://cors-anywhere.herokuapp.com/" });
                    translated=translated+translation.text+". ";
                }catch(err){
                    console.error("Translation Error:", err);
                }
            }
            testo=translated;
        }
        let summary= await generateSummary(testo)
        let text= await generateText(testo)
        array.push({titolo:"Text",testoAi:text,testo:testo,riassunto:summary,img:img})
    })
    return array
}
async function generateText(testo){
    try{
        dotenv.config();
        const apiKey = process.env.GOOGLE_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
        });
        const prompt = 'Transform the following text, maintaining the language, into an array of objects, where each object represents a paragraph of the text. Each object should have two properties: {title, text}.Example output: [{ "title": "Introduction", "text": "This text introduces the main topic..." },...].Text to process:'+testo;
        const result = await model.generateContent([prompt]);
        return JSON.parse(result.response.text().replace('```json\n','').replace('```','').replaceAll('\n',''));
    }catch(err){
        console.error(err)
        return testo
    }
}
async function generateSummary(testo) {
    try{
        dotenv.config();
        const apiKey = process.env.GOOGLE_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
        });
        const prompt = "Do a summary of the text, maintaining its language, max 500 character: "+testo;
        const result = await model.generateContent([prompt]);
        return(result.response.text());    
    }catch(err){
        console.error(err)
    }
    const frasi = testo.match(/[^\.!\?]+[\.!\?]+/g);
    const parole = testo.toLowerCase().split(/\W+/);
    const frequenzaParole = parole.reduce((map, parola) => {
        map[parola] = (map[parola] || 0) + 1;
        return map;
    }, {});
    let riassunto = "";
    if (frasi) {
        const punteggioFrasi = frasi.map(frase => {
            let punteggio = 0;
            const paroleFrase = frase.toLowerCase().split(/\W+/);
            paroleFrase.forEach(parola => {
                punteggio += frequenzaParole[parola] || 0;
            });
            return { frase, punteggio };
        });
        punteggioFrasi.sort((a, b) => b.punteggio - a.punteggio);
        let i = 0;
        riassunto = frasi[0];  // Start with the first sentence
        while (riassunto.length < 500 && i < punteggioFrasi.length) {
            if (!riassunto.includes(punteggioFrasi[i].frase)) {  // Avoid duplicating the first sentence
                riassunto += ' ' + punteggioFrasi[i].frase;
            }
            i++;
        }
    }
    return riassunto.trim();
}
