const httpStatus = require("http-status");
const { Cart, Product, User } = require("../models");
const ApiError = require("../utils/ApiError");
const config = require("../config/config");


/**
 * Fetches cart for a user
 * - Fetch user's cart from Mongo
 * - If cart doesn't exist, throw ApiError
 * --- status code  - 404 NOT FOUND
 * --- message - "User does not have a cart"
 *
 * @param {User} user
 * @returns {Promise<Cart>}
 * @throws {ApiError}
 */
const getCartByUser = async (user) => {
  const { email } = user;
  const cart = await Cart.findOne({ email });
  if (cart === null) {
    throw new ApiError(httpStatus.NOT_FOUND, "User does not have a cart");
  }
  return cart;
};

/**
 * Adds a new product to cart
 * - Get user's cart object using "Cart" model's findOne() method
 * --- If it doesn't exist, create one
 * --- If cart creation fails, throw ApiError with "500 Internal Server Error" status code
 *
 * - If product to add already in user's cart, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product already in cart. Use the cart sidebar to update or remove product from cart"
 *
 * - If product to add not in "products" collection in MongoDB, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product doesn't exist in database"
 *
 * - Otherwise, add product to user's cart
 *
 *
 *
 * @param {User} user
 * @param {string} productId
 * @param {number} quantity
 * @returns {Promise<Cart>}
 * @throws {ApiError}
 */
const addProductToCart = async (user, productId, quantity) => {
  try {
  const { email } = user
  let cart;
  cart = await Cart.findOne({ email });
  if (cart === null) {
      const userCart = {
        email
      }
      cart = await Cart.create(userCart);
  }
  if (cart.cartItems.some(item => (item.product._id).toString() === productId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Product already in cart. Use the cart sidebar to update or remove product from cart")
  }
  const product = await Product.findById(productId);
  if (product === null) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Product doesn't exist in database")
  }
  const cartItem = {
    product,
    quantity
  }
  cart.cartItems.push(cartItem);
  await cart.save();
  return cart;
} catch (err) {
  if (err instanceof ApiError) {
    throw err;
  }else{
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, err.message);
  }
}
};

/**
 * Updates the quantity of an already existing product in cart
 * - Get user's cart object using "Cart" model's findOne() method
 * - If cart doesn't exist, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "User does not have a cart. Use POST to create cart and add a product"
 *
 * - If product to add not in "products" collection in MongoDB, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product doesn't exist in database"
 *
 * - If product to update not in user's cart, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product not in cart"
 *
 * - Otherwise, update the product's quantity in user's cart to the new quantity provided and return the cart object
 *
 *
 * @param {User} user
 * @param {string} productId
 * @param {number} quantity
 * @returns {Promise<Cart>
 * @throws {ApiError}
 */
const updateProductInCart = async (user, productId, quantity) => {
  const { email } = user
  const cart = await Cart.findOne({ email });
  if (cart === null) {
    throw new ApiError(httpStatus.BAD_REQUEST, "User does not have a cart. Use POST to create cart and add a product")
  }
  const product = await Product.findById(productId);
  if (product === null) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Product doesn't exist in database")
  }
  if (!cart.cartItems.some(item => (item.product._id).toString() === productId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Product not in cart")
  }
  cart.cartItems.map(item => {
    if ((item.product._id).toString() === productId) {
      item.quantity = quantity;
    }
    return item;
  });
  await cart.save();
  return cart;
};

/**
 * Deletes an already existing product in cart
 * - If cart doesn't exist for user, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "User does not have a cart"
 *
 * - If product to update not in user's cart, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product not in cart"
 *
 * Otherwise, remove the product from user's cart
 *
 *
 * @param {User} user
 * @param {string} productId
 * @throws {ApiError}
 */
const deleteProductFromCart = async (user, productId) => {
  const { email } = user
  const cart = await Cart.findOne({ email });
  if (cart === null) {
    throw new ApiError(httpStatus.BAD_REQUEST, "User does not have a cart. Use POST to create cart and add a product")
  }
  const product = await Product.findById(productId);
  if (product === null) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Product doesn't exist in database")
  }
  if (!cart.cartItems.some(item => (item.product._id).toString() === productId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Product not in cart")
  }
  cart.cartItems = cart.cartItems.filter(item=>(item.product._id).toString() !== productId);
  await cart.save()
};


// TODO: CRIO_TASK_MODULE_TEST - Implement checkout function
/**
 * Checkout a users cart.
 * On success, users cart must have no products.
 *
 * @param {User} user
 * @returns {Promise}
 * @throws {ApiError} when cart is invalid
 */
const checkout = async (user) => {
  /*
  should throw 404 error if cart is not present
  should throw 400 error if user's cart doesn't have any product
  should throw 400 error if address is not set - when User.hasSetNonDefaultAddress() returns false
  should throw 400 error if wallet balance is insufficient
  should update user balance and empty the cart on success
  */
  const {email} = user;
  const cart = await Cart.findOne({email});
  if(cart===null){
    throw new ApiError(httpStatus.NOT_FOUND,"User does not have a cart")
  }
  if(cart.cartItems.length===0){
    throw new ApiError(httpStatus.BAD_REQUEST,"User's cart doesn't have any product")
  }
  const isDefault = await user.hasSetNonDefaultAddress(user.address);
  if(!isDefault){
    throw new ApiError(httpStatus.BAD_REQUEST,"User's address is not set")
  }
  let totalCost = 0;
  cart.cartItems.forEach(item=>{
    totalCost+=(item.product.cost*item.quantity);
  });
  if(totalCost>user.walletMoney){
    throw new ApiError(httpStatus.BAD_REQUEST,"wallet balance is insufficient")
  }
  user.walletMoney = user.walletMoney-totalCost;
  cart.cartItems = [];
  user.save();
  cart.save();
};

module.exports = {
  getCartByUser,
  addProductToCart,
  updateProductInCart,
  deleteProductFromCart,
  checkout,
};
