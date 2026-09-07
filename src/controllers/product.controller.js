import * as productService from "../services/product.service.js";
import * as productImportService from "../services/productImport.service.js";
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
    // Normal Add Product sends an object.
    // Excel import sends the complete product list as an array.
    if (Array.isArray(req.body)) {
      if (req.body.length === 0) {
        return res.status(400).json({
          message: "Excel file contains no products.",
        });
      }

      const products = await productImportService.replaceAllProducts(
        pool,
        req.body
      );

      return res.status(200).json(products);
    }

    const product = await productService.createProduct(pool, req.body);
    return res.status(201).json(product);
  } catch (error) {
    console.error("Product create/import error:", error);

    if (Array.isArray(req.body)) {
      return res.status(error.status || 500).json({
        message: error.message || "Product Excel import failed.",
      });
    }

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
      req.body
    );
    res.json(product);
  } catch (error) {
    next(error);
  }
}
