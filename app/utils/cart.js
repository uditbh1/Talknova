// app/utils/cart.js
import { redirect } from '@remix-run/node';
import { Cart } from '~/models/cart';
import { getUserFromSession } from '~/utils/auth.server';

export async function addToCart(request, courseId) {
  try {
    console.log('Adding course to cart:', courseId);
    const user = await getUserFromSession(request);
    if (!user) {
      console.log('User not found. Redirecting to login page.', user);
      return redirect('/login');
    }
    console.log('Adding course to cart:', courseId);
    let cart = await Cart.findOne({ user: user._id });
    if (!cart) {
      cart = new Cart({ user: user._id, courses: [] });
    }

    if (!cart.courses.includes(courseId)) {
      console.log('Adding course to cart:', courseId);
      cart.courses.push(courseId);
      await cart.save();
    }
    console.log('Adding course to cart:', courseId);
    return cart;
  } catch (error) {
    console.error('Error adding course to cart:', error);
    return redirect('/courses', { headers: { 'Set-Cookie': `flash=${error.message}; Path=/` } });
  }
}

// app/utils/cart.js
export async function removeFromCart(request, courseId) {
  const user = await getUserFromSession(request);
  if (!user) {
    return redirect('/login');
  }

  const cart = await Cart.findOne({ user: user._id });
  if (cart) {
    cart.courses = cart.courses.filter(id => id.toString() !== courseId);
    await cart.save();
  }

  return cart;
}
