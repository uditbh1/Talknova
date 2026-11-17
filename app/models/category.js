import { mongoose } from '~/config/db.server';
var Schema = mongoose.Schema;

// Define the subcategory schema
var subcategorySchema = new Schema(
  {
    name: { type: String, required: true }, // Name of the subcategory
    enabled: { type: Boolean, default: true }, // Enable/Disable subcategory
    image: { type: String, default: '' }, // Path for subcategory image
  },
  { _id: false } // Disabling _id for each subcategory to simplify the structure
);

// Define the main category schema
var categorySchema = new Schema(
  {
    name: { type: String, required: true, unique: true }, // Name of the category
    enabled: { type: Boolean, default: true }, // Enable/Disable category
    image: { type: String, default: '' }, // Path for category image
    isTrending: { type: Boolean, default: false }, // Trending category status
    subcategories: [subcategorySchema], // Array of subcategory objects
  },
  { timestamps: true } // Automatically manage createdAt and updatedAt timestamps
);

// Static method to fetch all categories
categorySchema.statics.getAllCategories = async function () {
  try {
    const categories = await this.find().sort({ updatedAt: -1 }).lean(); // Fetch all categories with subcategories
    return categories;
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
};

// Static method to fetch a specific category by name
categorySchema.statics.getCategoryByName = async function (name) {
  try {
    const category = await this.findOne({ name }).lean();
    return category || null;
  } catch (error) {
    console.error('Error fetching category by name:', error);
    return null;
  }
};

// Static method to update category status
categorySchema.statics.updateCategoryStatus = async function (name, enabled) {
  try {
    const category = await this.findOneAndUpdate({ name }, { enabled }, { new: true }).lean();
    return category;
  } catch (error) {
    console.error('Error updating category status:', error);
    return null;
  }
};

// Static method to update subcategory status within a specific category
categorySchema.statics.updateSubcategoryStatus = async function (categoryName, subcategoryName, enabled) {
  try {
    const category = await this.findOneAndUpdate(
      { name: categoryName, 'subcategories.name': subcategoryName },
      { $set: { 'subcategories.$.enabled': enabled } },
      { new: true }
    ).lean();

    return category;
  } catch (error) {
    console.error('Error updating subcategory status:', error);
    return null;
  }
};

categorySchema.statics.seedCategories = async function (categoriesData) {
  try {
    return false;
    // Iterate over each category in the provided data
    for (const [categoryName, subcategories] of Object.entries(categoriesData)) {
      // Check if the category already exists to avoid duplicates
      let category = await this.findOne({ name: categoryName });

      if (!category) {
        // If category doesn't exist, create a new one
        category = new this({
          name: categoryName,
          enabled: true, // default enabled status
          image: '', // default empty path, update as needed
          subcategories: subcategories.map(subcategoryName => ({
            name: subcategoryName,
            enabled: true, // default enabled status
            image: '', // default empty path, update as needed
          })),
        });
        console.log(`Inserting category "${categoryName}" with subcategories:`, subcategories);
        await category.save();
      } else {
        console.log(`Category "${categoryName}" already exists. Skipping insertion.`);
      }
    }
    console.log('Categories seeded successfully');
  } catch (error) {
    console.error('Error seeding categories:', error);
  }
};

// Export the model
export const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);
