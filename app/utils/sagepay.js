// imports
import crypto from 'crypto';
import querystring from 'querystring';
import moment from 'moment';
import SagepayAdminApiClient from 'sagepay-admin-api-client';

const sagepayOptions = {
  password: process.env.SAGEPAY_PASSWORD,
  vendor: process.env.SAGEPAY_VENDOR,
};

function validateTransaction(transaction) {
  const requiredFields = [
    'Amount',
    'Currency',
    'Description',
    'BillingSurname',
    'BillingFirstnames',
    'BillingAddress1',
    'BillingCity',
    'BillingPostCode',
    'BillingCountry',
    'DeliverySurname',
    'DeliveryFirstnames',
    'DeliveryAddress1',
    'DeliveryCity',
    'DeliveryPostCode',
    'DeliveryCountry',
  ];

  for (let field of requiredFields) {
    if (!transaction[field]) {
      return { status: 0, message: `Missing required field: ${field}` };
    }
  }

  // Validate Amount format
  if (!/^\d+(\.\d{1,2})?$/.test(transaction.Amount)) {
    return { status: 0, message: "Invalid format for 'Amount'. Must be a number with up to two decimal places." };
  }

  return { status: 1, message: 'Validation successful' };
}

function formatAmount(amount) {
  return parseFloat(amount).toFixed(2); // Formats the amount to two decimal places
}

function createHiddenFields(transaction) {
  try {
    // Format Amount
    transaction.Amount = formatAmount(transaction.Amount);

    // Validate transaction
    const validation = validateTransaction(transaction);
    if (validation.status === 0) {
      console.error(validation.message);
      return validation; // Return the validation object if there's an error
    }

    // Existing code to create hidden fields
    transaction = Object.keys(transaction)
      .map(key => `${key}=${transaction[key]}`)
      .join('&');
    const cipher = crypto.createCipheriv('aes-128-cbc', sagepayOptions.password, sagepayOptions.password);
    let crypt = '@';
    crypt += cipher.update(transaction, 'utf8', 'hex');
    crypt += cipher.final('hex');

    return {
      status: 1,
      VPSProtocol: '3.00',
      TxType: 'PAYMENT',
      Vendor: sagepayOptions.vendor,
      crypt,
    };
  } catch (error) {
    return { status: 0, message: error.message };
  }
}

function decodeResponse(crypt) {
  if (crypt[0] !== '@') {
    throw new Error('Encrypted response must begin with the @ symbol.');
  }
  crypt = crypt.substr(1);
  const decipher = crypto.createDecipheriv('aes-128-cbc', sagepayOptions.password, sagepayOptions.password);
  let decrypted = decipher.update(crypt, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return querystring.parse(decrypted);
}

async function getRecentTransactions() {
  try {
    const client = new SagepayAdminApiClient({
      user: process.env.SAGEPAY_USER,
      password: process.env.SAGEPAY_PWD,
      vendor: process.env.SAGEPAY_VENDOR,
    });

    const enddate = moment().format('DD/MM/YYYY hh:mm:ss');
    const startdate = moment().subtract(30, 'days').format('DD/MM/YYYY hh:mm:ss');

    const data = await client.request({
      command: 'getTransactionList',
      startdate: startdate,
      enddate: enddate,
    });

    return data.transactions.length > 0 ? data.transactions[0].transaction : [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

export { createHiddenFields, decodeResponse, getRecentTransactions };
