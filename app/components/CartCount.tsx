import { useEffect, useState } from 'react';
import { useFetcher, useLoaderData } from '@remix-run/react';

export default function CartCount() {
  const fetcher = useFetcher();
  const [count, setCount] = useState(0);
  const { user } = useLoaderData();

  const updateCartCount = () => {
    if (user && user._id) {
      fetcher.load('/api/cart-count');
    } else {
      let cartCount = 0;
      if (typeof window !== 'undefined') {
        const cartData = JSON.parse(localStorage.getItem('cart'));
        if (cartData && Array.isArray(cartData.courses)) {
          cartCount = cartData.courses.length;
        }
      }
      setCount(cartCount);
    }
  };

  useEffect(() => {
    if (user && typeof window !== 'undefined') {
      const cartData = localStorage.getItem('cart');
      if (cartData) {
        fetcher.submit({ cartData }, { method: 'post', action: '/api/move-cart' });
      } else {
        updateCartCount();
      }
    } else {
      updateCartCount();
    }
  }, [user]);

  useEffect(() => {
    window.addEventListener('cartUpdated', updateCartCount);

    return () => {
      window.removeEventListener('cartUpdated', updateCartCount);
    };
  }, []);

  useEffect(() => {
    if (fetcher.data?.success) {
      console.log('Removing cart data from localStorage after successful move');
      localStorage.removeItem('cart');
      fetcher.load('/api/cart-count');
    } else if (fetcher.data?.count !== undefined) {
      setCount(fetcher.data.count);
    }
  }, [fetcher.data]);

  return <span>{count}</span>;
}
