const urlModel=require("../models/urlModel")
const shortId=require("shortid")
const redis = require("redis");

// Here we create radis server and connect to radis cach memory to use cashing in this code.
const { promisify } = require("util");

const redisClient = redis.createClient(
    12332,
    "redis-12332.c264.ap-south-1-1.ec2.cloud.redislabs.com",
    { no_ready_check: true }
);
redisClient.auth("VAvDAeruo7z3OWTC0lsjkA3KdF1WgXHk", function (err) {
    if (err) throw err;
});


redisClient.on("connect", async function () {
    console.log("Connected to Redis..");
});

//Connection setup for redis

const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);
const SET_EX = promisify(redisClient.SETEX).bind(redisClient)

const rexURL = /^(http|https):\/\/(www\.)?[-a-zA-Z0-9@:%.\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%\+.~#?&//=]*)$/
const coderegex =/^[A-Za-z0-9 _\-]{7,14}$/

function isValid(value) {
    if (typeof value === "undefined" || typeof value === null) return false;
    if (typeof value === "string" && value.trim().length === 0) return false;
    return true;
  }

const createURL=async(req,res)=>{
    try{

        let {longUrl,...rest}=req.body;
//-----------------------------VALIDATION STARTS------------------------------//
        if(Object.keys(rest).length>0)return res.status(400).send({ status: false,message:"Invalid attributes"})        
        if(!isValid(longUrl))return res.status(400).send({ status: false,message:"long url should be present"})  
        if(!longUrl.match(rexURL))return res.status(400).send({ status: false,message:"URL not a Valid "})  
        let LongUrl = await GET_ASYNC(`${longUrl}`)
        let parseData=JSON.parse(LongUrl)
        if (parseData) return res.status(302).send({ status: true, msg: "This Url exists in Cache.", urlDetails:parseData })
        const checkURL=await urlModel.findOne({longUrl}).select({__v:0,_id:0}) 
        if (checkURL) {
            await SET_EX(`${longUrl}`, 10,JSON.stringify(checkURL))
            return res.status(302).send({ status: true, msg: "This Url exists in DB", urlDetails: checkURL })
        }//Storing data while creation is not a good thing to implement this is just for a better understanding of cache
//--------------------------------------------------------------------------------// 
        const urlCode=shortId.generate().toLowerCase()
        const baseURL="http://localhost:3000/"
        const shortUrl=`${baseURL}${urlCode}`
        const result={longUrl,shortUrl,urlCode} 
        const newResult=await urlModel.create(result)
        const data = {longUrl:newResult.longUrl,shortUrl:newResult.shortUrl,urlCode:newResult.urlCode}
        //storing newly data in cache
        await SET_EX(`${longUrl}`,10, JSON.stringify(data))

        return res.status(201).send({ status: true,data: data})
    }catch(error){
        return res.status(500).send({ status: false,message: error.message})
    }
}

const getByID=async(req,res)=>{
    try{
        let urlCode=req.params.urlCode;
        if(!urlCode.match(coderegex)) return res.status(400).send({status :false , message : " Invalid urlcode "})
        let cahcedProfileData = await GET_ASYNC(`${urlCode}`)
        let parseData = JSON.parse(cahcedProfileData)
        if(cahcedProfileData){ return res.status(302).redirect(parseData.longUrl)
        }else{
            const result=await urlModel.findOne({urlCode})
            if(!result)return res.status(404).send({status:false,message:" urlcode Not Found"})
            let time=10*60  //10 minutes
            await SET_EX(`${urlCode}`,time,JSON.stringify(result))
            return res.status(302).redirect(result.longUrl)
        }}
    catch(error){
        return res.status(500).send({ status: false,message: error.message})
    }
}

module.exports={createURL,getByID}