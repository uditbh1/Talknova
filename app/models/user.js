import { mongoose } from "~/config/db.server";
import pkg from "bcryptjs";
const { hash, compare } = pkg;
var Schema = mongoose.Schema;

var userSchema = new Schema(
  {
    title: { type: String, default: "Mr" },
    firstName: {
      type: String,
      required: [true, "Please enter first name"],
      maxLength: [50, "Your name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Please enter last name"],
      maxLength: [50, "Your name cannot exceed 50 characters"],
    },
    middleName: { type: String, required: false, default: "" },
    password: {
      type: String,
      required: [true, "Please enter your password"],
      minLength: [6, "Your password must be longer than 6 characters"],
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    roles: [{ type: String, required: true, uppercase: true }], //SUPERADMIN, LEARNER, COURSEPROVIDER
    modules: [{ type: Schema.Types.ObjectId, ref: "Module" }],
    image: { type: String, required: false, default: "no-image.png" },
    dob: { type: Date, required: false, default: Date.now },
    gender: { type: String, default: "MALE" },
    emailVerified: { type: Boolean, default: false },
    phone: { type: String, default: "" },
    mobile: { type: String, default: "" },
    postcode: { type: String, default: "" },
    addressLine1: { type: String, default: "" },
    addressLine2: { type: String, default: "" },
    deleted: { type: Boolean, default: false },
    status: { type: Boolean, default: false }, // false == Inactive, true == Active
    country: { type: String, default: "" },
    // Course provider specific fields
    nickname: { type: String, required: false, default: "" },
    city: { type: String, default: "" },
    county: { type: String, default: "" },
    aboutMe: { type: String, default: "" },
    currentPosition: { type: String, default: "" },
    website: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    facebook: { type: String, default: "" },
    twitter: { type: String, default: "" },
    tiktok: { type: String, default: "" },
    dateOfJoining: { type: Date, required: false, default: Date.now },
    //courses: [{ type: Schema.Types.ObjectId, ref: "Course" }],
    company: { type: String, required: false, default: "" },
    // Magic link login fields
    magicLinkToken: { type: String, required: false },
    magicLinkExpiry: { type: Date, required: false },
    // Track if user has seen the welcome popup after verification
    welcomePopupShown: { type: Boolean, default: false },
    // Track if user signed up via buy-plan-reg flow (needs temporary password after payment)
    fromBuyPlanReg: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Encrypting password before saving user
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }

  this.password = await hash(this.password, 10);
});

// Compare user password
userSchema.statics.comparePassword = async function (
  enteredPassword,
  dbPassword
) {
  return await compare(enteredPassword, dbPassword);
};

// Delete existing model if it exists (forces schema recompilation)
// This ensures new schema fields like fromBuyPlanReg are properly included
if (mongoose.models.User) {
  delete mongoose.models.User;
}

export const User = mongoose.model("User", userSchema);
