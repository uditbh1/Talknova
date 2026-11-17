import { json } from "@remix-run/node";
import { ReviewModel } from "~/models/review";

export async function loader({ request }) {
  try {
    // Get only published reviews, sorted by creation date (newest first)
    const reviews = await ReviewModel.find({ 
      isPublished: true, 
      status: true 
    })
    .select('name email rating reviewText createdAt')
    .sort({ createdAt: -1 })
    .limit(10) // Limit to 10 most recent reviews
    .lean();

    // If no reviews found, return dummy data
    if (!reviews || reviews.length === 0) {
      const dummyReviews = [
        {
          _id: 'dummy1',
          name: 'Sarah Johnson',
          email: 'sarah@example.com',
          rating: 5,
          reviewText: 'Excellent service! The AI chatbot integration was seamless and has greatly improved our customer support efficiency.',
          createdAt: new Date('2024-01-15')
        },
        {
          _id: 'dummy2',
          name: 'Michael Chen',
          email: 'michael@example.com',
          rating: 5,
          reviewText: 'Outstanding platform! The document management and AI assistance features have transformed how we handle customer inquiries.',
          createdAt: new Date('2024-01-10')
        },
        {
          _id: 'dummy3',
          name: 'Emily Rodriguez',
          email: 'emily@example.com',
          rating: 4,
          reviewText: 'Great experience overall. The interface is intuitive and the AI responses are very accurate. Highly recommended!',
          createdAt: new Date('2024-01-05')
        }
      ];
      return json({ reviews: dummyReviews, isDummy: true });
    }

    return json({ reviews, isDummy: false });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    
    // Return dummy data in case of error
    const dummyReviews = [
      {
        _id: 'dummy1',
        name: 'Sarah Johnson',
        email: 'sarah@example.com',
        rating: 5,
        reviewText: 'Excellent service! The AI chatbot integration was seamless and has greatly improved our customer support efficiency.',
        createdAt: new Date('2024-01-15')
      },
      {
        _id: 'dummy2',
        name: 'Michael Chen',
        email: 'michael@example.com',
        rating: 5,
        reviewText: 'Outstanding platform! The document management and AI assistance features have transformed how we handle customer inquiries.',
        createdAt: new Date('2024-01-10')
      },
      {
        _id: 'dummy3',
        name: 'Emily Rodriguez',
        email: 'emily@example.com',
        rating: 4,
        reviewText: 'Great experience overall. The interface is intuitive and the AI responses are very accurate. Highly recommended!',
        createdAt: new Date('2024-01-05')
      }
    ];
    return json({ reviews: dummyReviews, isDummy: true });
  }
}