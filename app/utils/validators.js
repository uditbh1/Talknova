import { Validator } from 'node-input-validator';

//Format to UL LI
export async function formatErrors(data) {
  let str = '<div class="validation-summary-errors"><h3>Please fix the following errors:</h3><ul>';
  for (var key in data) {
    if (data.hasOwnProperty(key)) {
      str += `<li>${data[key]?.message}</li>`;
    }
  }
  str += '</ul></div>';
  return str;
}

//Format to array of strings
export async function formatErrorsArrStr(data) {
  let arr = [];
  for (var key in data) {
    if (data.hasOwnProperty(key)) {
      arr.push(data[key]?.message);
    }
  }

  return arr;
}

function setValidatorNiceNames(v) {
  v.niceNames({
    email: 'Email',
    firstName: 'First Name',
    password: 'Passoword',
    dob: 'Date of Birth',
    addressLine1: 'Address Line1',
    addressLine2: 'Address Line2',
    postcode: 'Postcode',
    phone: 'Phone',
    academicEmail: 'Academic Email',
    intake: 'Intake',
  });
}

export async function loginValidator(data, format = true) {
  try {
    let schema = {
      email: 'required|minLength:5',
      password: 'required',
    };

    const v = new Validator(data, schema);
    setValidatorNiceNames(v);
    const matched = await v.check();

    if (format && !matched) {
      let formattedErrors = await this.formatErrorsArrStr(v.errors);
      return { status: false, errors: formattedErrors };
    }
    if (!matched) return { status: false, errors: v.errors };
    return { status: true, errors: null };
  } catch (error) {
    console.error('Error in loginValidator:', error);
  }
}
