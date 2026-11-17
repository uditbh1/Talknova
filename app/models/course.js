import { mongoose } from '~/config/db.server';
var Schema = mongoose.Schema;

const courseSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, //Provider
    name: { type: String, required: true },
    group: { type: String, required: true },
    category: { type: String, required: true },
    subCategory: { type: String, required: true },
    price: { type: Number, required: true },
    oldPrice: { type: Number },
    reducedPrice: { type: Number, required: true },
    description: { type: String, required: true },
    whatYouWillLearn: { type: String, required: true },
    whoThisCourseIsFor: { type: String, required: true },
    requirements: { type: String, required: false },
    image: { type: String, required: true },
    isTrending: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Course = mongoose.models.Course || mongoose.model('Course', courseSchema);
