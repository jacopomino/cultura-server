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
function distance(coord1, coord2) {
    const dx = coord1[0] - coord2[0];
    const dy = coord1[1] - coord2[1];
    return Math.sqrt(dx * dx + dy * dy);
}

function nearestNeighbor(coordinates, startIndex = 0) {
    const path = [];
    const visited = new Set();
    let current = startIndex;
    
    while (path.length < coordinates.length) {
        path.push(coordinates[current]);
        visited.add(current);
        
        let next = null;
        let minDist = Infinity;
        
        for (let i = 0; i < coordinates.length; i++) {
            if (!visited.has(i)) {
                const dist = distance(coordinates[current], coordinates[i]);
                if (dist < minDist) {
                    minDist = dist;
                    next = i;
                }
            }
        }
        
        if (next !== null) current = next;
    }
    
    return path;
}

parentPort.on("message",message=>{
    if(message.type==="start"){
        let info=message.body
        const bbox=info.latSw+","+info.lonSw+","+info.latNe+","+info.lonNe
        let filtri=`
            nwr["tourism"="artwork"](${bbox});
            nwr["historic"="archaeological_site"](${bbox});
            nwr["tourism"="attraction"](${bbox});
            nwr["natural"="beach"](${bbox});
            nwr["historic"="castle"](${bbox});
            nwr["tourism"="museum"](${bbox});
            nwr["amenity"="place_of_worship"](${bbox});
            nwr["historic"="ruins"](${bbox});
            nwr["tourism"="viewpoint"](${bbox});
        `
        if(info['filtro[]']){
            if(!Array.isArray(info['filtro[]']))info['filtro[]']=Array(info['filtro[]'])
            filtri=''
            info['filtro[]'].map(f=>{
                if(f==="art")filtri+=(`nwr["tourism"="artwork"](${bbox});`)
                else if(f==="archaeological_sites")filtri+=(`nwr["historic"="archaeological_site"](${bbox});`)
                else if(f==="attractions")filtri+=(`nwr["tourism"="attraction"](${bbox});`)
                else if(f==="beach")filtri+=(`nwr["natural"="beach"](${bbox});`)
                else if(f==="castles")filtri+=(`nwr["historic"="castle"](${bbox});`)
                else if(f==="museums")filtri+=(`nwr["tourism"="museum"](${bbox});`)
                else if(f==="religious_places")filtri+=(`nwr["amenity"="place_of_worship"](${bbox});`)
                else if(f==="ruins")filtri+=(`nwr["historic"="ruins"](${bbox});`)
                else if(f==="viewpoint")filtri+=(`nwr["tourism"="viewpoint"](${bbox});`)
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
            const elements = response.data.elements.filter(i => i.tags.name && (i.tags.wikipedia || i.tags.wikidata));
            const coords=elements.filter(i=>i.tags.tourism==='attraction').map(i =>{
                if(i.lat&&i.lon)return[i.lat,i.lon]
                else return[(i.bounds.maxlat+i.bounds.minlat)/2,(i.bounds.maxlon+i.bounds.minlon)/2]
            });
            const orderedCoords = nearestNeighbor(coords);
            const datas={
                marker:elements,
                bestRoute:orderedCoords
            }
            parentPort.postMessage(datas);
        }).catch(error => {
            parentPort.postMessage({type:"error",error:error});
            console.error('Errore durante la richiesta Overpass:', error);
        });
    }
})