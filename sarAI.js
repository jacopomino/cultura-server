import {parentPort} from "worker_threads"
import axios from "axios"
import {MongoClient,ObjectId} from "mongodb"
import {GoogleGenerativeAI} from "@google/generative-ai";
import dotenv from 'dotenv';

const client=new MongoClient("mongodb://apo:jac2001min@cluster0-shard-00-00.pdunp.mongodb.net:27017,cluster0-shard-00-01.pdunp.mongodb.net:27017,cluster0-shard-00-02.pdunp.mongodb.net:27017/?ssl=true&replicaSet=atlas-me2tz8-shard-0&authSource=admin&retryWrites=true&w=majority")
let db

parentPort.on("message",async(message)=>{
    if(message.type==="start"){
        let info=message.body
        const response=await generateText(info.request,info.text,info.lingua)
    }else{
        error()
    }
})
async function generateText(request,text,lingua){
    try{
        dotenv.config();
        const apiKey = process.env.GOOGLE_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
        });
        const prompt = "I will provide you with a question and a reference text. Please answer the question based only on the given text, in a clear and detailed manner and using selected language. Here is the question: "+request+", Here is the reference text: "+text+", Language: "+lingua;
        const result = await model.generateContent([prompt]);
        parentPort.postMessage(result.response.text())
    }catch(err){
        console.error(err)
        error()
    }
}
const error=()=>{
    parentPort.postMessage({type:"error",error:"Internal Server Error. Try Again!"})
}