import {parentPort} from "worker_threads"
import gTTS from "gtts"
import fs from "fs"
import path from "path"

parentPort.on("message",message=>{
    if(message.type==="start"){
        let info=message.body
        let random=info.id.split(" ")[0]+info.id.split(" ")[1]
        fs.access(path.resolve('Voice'+random+'.mp3'),fs.constants.F_OK,err=>{
            if (!err){
                fs.unlink(path.resolve('Voice'+random+'.mp3'), (err) => {
                    if (err) {
                        parentPort.postMessage({type:"error",error:err});
                    }
                });
            }
        })
        const combinedSpeech =new gTTS(info.titolo+". "+info.testo, info.lingua);
        combinedSpeech.save('Voice'+random+'.mp3', function (err, result){
            if(err){ 
                parentPort.postMessage({type:"error",error:err});
            }else{
                parentPort.postMessage("audio/"+random)
                setTimeout(()=>{
                    fs.unlink(path.resolve('Voice'+random+'.mp3'), (err) => {
                        if (err) {
                            console.error('Errore durante l\'eliminazione del file:', err);
                            return;
                        }
                    });
                },2000)
            }
        });
    }
})