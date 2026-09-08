import * as productService from "../services/product.service.js";
import * as productImportService from "../services/productImport.service.js";
import { pool } from "../config/database.js";

export async function getAll(req,res,next){try{res.json(await productService.getAllProducts(pool));}catch(e){next(e);}}
export async function getById(req,res,next){try{res.json(await productService.getProductById(pool,req.params.id));}catch(e){next(e);}}
export async function create(req,res,next){
  try{
    if(Array.isArray(req.body)){
      if(!req.body.length)return res.status(400).json({message:"Excel file contains no products."});
      return res.status(200).json(await productImportService.replaceAllProducts(pool,req.body));
    }
    return res.status(201).json(await productService.createProduct(pool,req.body));
  }catch(e){console.error("Product create/import error:",e);if(Array.isArray(req.body))return res.status(e.status||500).json({message:e.message||"Product Excel import failed."});next(e);}
}
export async function update(req,res,next){try{res.json(await productService.updateProduct(pool,req.params.id,req.body));}catch(e){next(e);}}
export async function remove(req,res,next){try{await productService.deleteProduct(pool,req.params.id);res.status(204).send();}catch(e){next(e);}}
export async function updateStatus(req,res,next){try{const {status}=req.body||{};res.json(await productService.updateProductStatus(pool,req.params.id,status));}catch(e){next(e);}}
