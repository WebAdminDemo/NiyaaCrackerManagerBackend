import * as productService from "../services/product.service.js";
import { pool } from "../config/database.js";

export async function getAll(req, res, next) {
  try {
    const products = await productService.getAllProducts(pool);
    res.json(products);
  } catch (error) {
    next(error);
  }
}

export async function getById(req, res, next) {
  try {
    const product = await productService.getProductById(pool, req.params.id);
    res.json(product);
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const product = await productService.createProduct(pool, req.body);
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const product = await productService.updateProduct(
      pool,
      req.params.id,
      req.body
    );

    res.json(product);
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    await productService.deleteProduct(pool, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(req, res, next) {
  try {
    const product = await productService.updateProductStatus(
      pool,
      req.params.id,
      req.body?.status
    );

    res.json(product);
  } catch (error) {
    next(error);
  }
}