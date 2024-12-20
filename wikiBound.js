import {parentPort} from "worker_threads"
import axios from "axios"

async function fetchImage(wikidataId) {
    const query = `
        SELECT ?image WHERE {
            wd:${wikidataId} wdt:P18 ?image.
        }
    `;
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
    try {
        const response = await axios.get(url);
        const bindings = response.data.results.bindings;
        if (bindings.length > 0) {
            return bindings[0].image.value;
        }
    } catch (error) {
        //console.error('Error fetching image from Wikidata:', error);
    }
    return null;
}

parentPort.on("message",message=>{
    if(message.type==="start"){
        let info=message.body
        const bbox=info.latSw+","+info.lonSw+","+info.latNe+","+info.lonNe
        let filtri=`nwr["tourism"="artwork"](${bbox});
            nwr["historic"="archaeological_site"](${bbox});
            nwr["tourism"="attraction"](${bbox});
            nwr["historic"="castle"](${bbox});
            nwr["tourism"="museum"](${bbox});
            nwr["amenity"="place_of_worship"](${bbox});
            nwr["historic"="ruins"](${bbox});`
        if(info['filtro[]']){
            if(!Array.isArray(info['filtro[]']))info['filtro[]']=Array(info['filtro[]'])
            filtri=''
            info['filtro[]'].map(f=>{
                if(f==="art")filtri+=(`nwr["tourism"="artwork"](${bbox});`)
                else if(f==="archaeological_sites")filtri+=(`nwr["historic"="archaeological_site"](${bbox});`)
                else if(f==="attractions")filtri+=(`nwr["tourism"="attraction"](${bbox});`)
                else if(f==="castles")filtri+=(`nwr["historic"="castle"](${bbox});`)
                else if(f==="museums")filtri+=(`nwr["tourism"="museum"](${bbox});`)
                else if(f==="religious_places")filtri+=(`nwr["amenity"="place_of_worship"](${bbox});`)
                else if(f==="ruins")filtri+=(`nwr["historic"="ruins"](${bbox});`)
            })
        }
        const query = `
        [out:json];
        (${filtri});
        out geom;
        `
        axios.post('https://overpass-api.de/api/interpreter', query).then(async response => {
            for (let element of response.data.elements.filter(i => i.tags.name && (i.tags.wikipedia || i.tags.wikidata))) {
                let imageUrl = null;
                if (element.tags.wikidata) {
                    imageUrl = await fetchImage(element.tags.wikidata);
                } else if (element.tags.wikipedia) {
                    const wikidataId = element.tags.wikipedia.split(':')[1];
                    imageUrl = await fetchImage(wikidataId);
                }
                if (imageUrl) {
                    element.imageUrl = imageUrl;
                }
            }
            parentPort.postMessage(response.data.elements.filter(i=>i.tags.name&&(i.tags.wikipedia||i.tags.wikidata)));
        }).catch(error => {
            parentPort.postMessage({type:"error",error:error});
            console.error('Errore durante la richiesta Overpass:', error);
        });
    }
})