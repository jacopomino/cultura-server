import {parentPort} from "worker_threads"
import axios from "axios"
import cheerio from "cheerio"

parentPort.on("message",async(message)=>{
    if(message.type==="start"){
        let info=message.body
        if(info.wikidata){
            const response = await axios.get(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks/urls&ids=${info.wikidata}`);
            let lingua=info.lingua
            let obj=response.data.entities[Object.keys(response.data.entities)].sitelinks[lingua+"wiki"]
            if(!obj){
                obj=response.data.entities[Object.keys(response.data.entities)].sitelinks["enwiki"]
            }
            /*if(!obj){
                for(let x of Object.values(response.data.entities[Object.keys(response.data.entities)].sitelinks)){
                    if(!x.site.includes("commons"))lingua=x.site.split("wiki")[0];
                    obj=response.data.entities[Object.keys(response.data.entities)].sitelinks[lingua+"wiki"]
                }
            }*/
            if(obj){
                axios.get("https://"+lingua+".wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&redirects=true&titles="+obj.title).then(e=>{
                    if(e.data.query.pages[Object.keys(e.data.query.pages)].pageid){
                        text("https://"+lingua+".wikipedia.org/w/api.php?action=parse&prop=text&format=json&pageid="+e.data.query.pages[Object.keys(e.data.query.pages)].pageid,info.lingua,lingua) 
                    }else{
                        error(info.lingua)
                    }
                })
            }else{
                error(info.lingua)
            }
        }else if(info.lat&&info.lon){
            axios.get("https://"+lingua+".wikipedia.org/w/api.php?action=query&format=json&list=geosearch&gscoord="+info.lat+"|"+info.lon+"&gsradius=1000&redirects=true&gssearch="+info.nome).then(e=>{
                if(e.data.query.geosearch[0]){
                    text("https://"+lingua+".wikipedia.org/w/api.php?action=parse&prop=text&format=json&pageid="+e.data.query.geosearch[0].pageid,info.lingua,lingua)
                }else{
                    error(info.lingua)
                }
            })
        }else{
            axios.get("https://"+lingua+".wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&redirects=true&titles="+info.nome).then(e=>{
                if(e.data.query.pages[Object.keys(e.data.query.pages)].pageid){
                    text("https://"+lingua+".wikipedia.org/w/api.php?action=parse&prop=text&format=json&pageid="+e.data.query.pages[Object.keys(e.data.query.pages)].pageid,info.lingua,lingua)
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
    let testo="I can't find any information about it."
    let summary="I can't find any information about it."
    parentPort.postMessage({type:"error",error:[{titolo:titolo,testo:testo,riassunto:summary}]})
}
//funzione per ottenere il testo in base alla pagina da analizzare
const text=(url,lingua,lingua2)=>{
    axios.get(url).then(async i=>{
        const img=[]
        cheerio.load(i.data.parse.text["*"])("img").map((i,n)=>{
            n.attribs.src.match(/\b\d{3}px\b/)&&img.push("https:"+n.attribs.src)
        })
        const array=[]
        let testo=cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr p').text().replace("Altri progetti","")
        let summary=generateSummary(testo)
        /*if(lingua!==lingua2){
            if(summary.length>500){
                let parts=splitText(summary,500)
                summary=""
                for(let part of parts){
                    let translated= await translateText(part,lingua)
                    summary=summary+" "+translated
                }
            }else{
                let translated=await translateText(summary,lingua)
                summary=translated
            }
            if(testo.length>500){
                let parts=splitText(testo,500)
                testo=""
                for(let part of parts){
                    let translated=await translateText(part,lingua)
                    testo=testo+" "+translated
                }
            }else{
                let translated=await translateText(testo,lingua)
                testo=translated
            }
        }*/
        array.push({titolo:"Text",testo:testo,riassunto:summary,img:img})
        if(array.length>0){
            parentPort.postMessage(array)
        }else{
            error(lingua)
        }
        /*let primoH3
        let h
        if(cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h2').text()!==""){
            if(cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h2').eq(0).text()==="Indice"){
                primoH3=cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h2').eq(1)
            }else{
                primoH3=cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h2').eq(0)
            }
            h=(cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h2'));
        }else if(cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h3').text()!==""){
            if(cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h3').eq(0).text()==="Indice"){
                primoH3=cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h3').eq(1)
            }else{
                primoH3=cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h3').eq(0)
            }
            h=(cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h3'));
        }
        if(primoH3){
            const paragrafo=primoH3.prevAll("p")
            let p=""
            paragrafo.each((index, element)=>{
                p=(cheerio.load(i.data.parse.text["*"])(element).text())+" "+p;
            });
            let summary=""
            if(p!==""){
                summary=generateSummary(p)
                let titolo="In generale"
                let testo=p
                if(lingua==="en"){
                    titolo="In general"
                }
                array.push({titolo:titolo,testo:testo,riassunto:summary,img:img})
            }
        }
        if(h){
            h.each((index, element)=>{
                let titolo=(cheerio.load(i.data.parse.text["*"])(element).text().replace(/\[.*?\]/g,""));
                let testo=""
                let summary=""
                const paragraphs=cheerio.load(i.data.parse.text["*"])(element).nextUntil('h2', 'p')
                if(titolo!=="Notes"&&titolo!=="Note"&&titolo!=="Galleria d'immagini"&&titolo!=="Photo gallery"&&titolo!=="Voci correlate"&&titolo!=="References"&&titolo!=="Altri progetti"&&titolo!=="Collegamenti esterni"&&titolo!=="External links"&&titolo!=="See also"){
                    paragraphs.each((index, paragraph)=>{
                        testo=testo+" "+cheerio.load(i.data.parse.text["*"])(paragraph).text();
                    });
                    if(testo!==""){
                        summary=generateSummary(testo)
                        array.push({titolo:titolo,testo:testo,riassunto:summary,img:img})
                    }
                }
            });
            if(array.length>0){
                parentPort.postMessage(array)
            }else{
                error(lingua)
            }
        }else{
            error(lingua)
        }*/
    })
}
function generateSummary(testo){
    const frasi = testo.match(/[^\.!\?]+[\.!\?]+/g);
    const parole = testo.split(/\W+/);
    const frequenzaParole = parole.reduce((map, parola) => {
        map[parola] = (map[parola] || 0) + 1;
        return map;
    }, {});
    let riassunto = "";
    if (frasi) {
        const punteggioFrasi = frasi && frasi.map(frase => {
            let punteggio = 0;
            const paroleFrase = frase.split(/\W+/);
            paroleFrase.forEach(parola => {
                punteggio += frequenzaParole[parola] || 0;
            });
            return { frase, punteggio };
        });
        punteggioFrasi.sort((a, b) => b.punteggio - a.punteggio);
        let paroleRiassunto = 0;
        let i = 0;
        while(paroleRiassunto < 200 && i < punteggioFrasi.length) {
            const paroleFrase = punteggioFrasi[i].frase.split(/\W+/);
            if (paroleRiassunto + paroleFrase.length <= 100) {
                riassunto += punteggioFrasi[i].frase + ' ';
                paroleRiassunto += paroleFrase.length;
            }
            i++;
        }
    }
    return riassunto.trim();
}
async function translateText(text, target) {
    try {
      const response = await axios.post('https://libretranslate.de/translate', {
        q: text,
        source: 'auto',
        target: target,
        format: 'text'
      }, {
        headers: { 'Content-Type': 'application/json' }
      });
  
      return response.data.translatedText;
    } catch (error) {
      console.error('Error while translating text:', error);
      return null;
    }
  }
function splitText(text, maxLength) {
    const result = [];
    let startIndex = 0;
    while (startIndex < text.length) {
      let endIndex = Math.min(startIndex + maxLength, text.length);
      // Cerca l'ultimo spazio prima del limite di lunghezza per evitare di spezzare le parole
      if (endIndex < text.length) {
        const lastSpaceIndex = text.lastIndexOf(' ', endIndex);
        if (lastSpaceIndex > startIndex) {
          endIndex = lastSpaceIndex;
        }
      }
      const chunk = text.slice(startIndex, endIndex);
      result.push(chunk.trim());
      startIndex = endIndex;
    }
    return result;
  }
