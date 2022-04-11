const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const morgan = require("morgan");
const { uuid } = require("uuidv4");

const { Client, Config, CheckoutAPI, Modification, hmacValidator } = require("@adyen/api-library");
// init app
const app = express();
// setup request logging
app.use(morgan("dev"));
// Parse JSON bodies
app.use(express.json());
// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));
// Serve client from build folder
app.use(express.static(path.join(__dirname, "build")));

// enables environment variables by
// parsing the .env file and assigning it to process.env
dotenv.config({
  path: "./.env",
});

// Adyen Node.js API library boilerplate (configuration, etc.)
const config = new Config();
config.apiKey = process.env.REACT_APP_ADYEN_API_KEY;
const client = new Client({ config });
client.setEnvironment("TEST");
const checkout = new CheckoutAPI(client);
const modification = new Modification(client);
const validator = new hmacValidator();

// in memory store for transaction
const paymentStore = {};

/* ################# API ENDPOINTS ###################### */
app.get("/api/getPaymentDataStore", async (req, res) => res.json(paymentStore));

// Submitting a payment
app.post("/api/sessions", async (req, res) => {
  const { allowedPaymentMethods } = req.body;
  console.log("allowedPaymentMethods", allowedPaymentMethods);
  try {
    // unique ref for the transaction
    const orderRef = uuid();

    console.log("Received payment request for orderRef: " + orderRef);
    const body = {
      amount: { currency: "EUR", value: 1000 }, // value is 10€ in minor units
      reference: orderRef, // required
      merchantAccount: process.env.REACT_APP_ADYEN_MERCHANT_ACCOUNT, // required
      channel: "Web", // required
      returnUrl: `http://localhost:8080/redirect?orderRef=${orderRef}`, // required for 3ds2 redirect flow
      allowedPaymentMethods: allowedPaymentMethods ? allowedPaymentMethods : null, // optional
      additionalData: { executeThreeD: true }, // optional
      captureDelayHours: 0,
    };
    console.log("body", body);

    // Ideally the data passed here should be computed based on business logic
    const response = await checkout.sessions({
      ...body,
    });

    console.log("response", response);
    // save transaction in memory
    paymentStore[orderRef] = {
      amount: { currency: "EUR", value: 1000 },
      reference: orderRef,
    };

    res.json([response, orderRef]); // sending a tuple with orderRef as well to inform about the unique order reference
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.status(err.statusCode).json(err.message);
  }
});

// Cancel or Refund a payment
app.post("/api/cancelOrRefundPayment", async (req, res) => {
  // Create the payload for cancelling payment
  const payload = {
    merchantAccount: process.env.REACT_APP_ADYEN_MERCHANT_ACCOUNT, // required
    reference: uuid(),
  };

  try {
    // Return the response back to client
    console.log("paymentStore", paymentStore, payload, paymentStore[req.query.orderRef], req.query.orderRef);
    // here we sent the authorized or captured payment's reference which is paymentStore[req.query.orderRef].paymentRef
    // and also payload as merchantAccount and unique new reference id
    const response = await modification.reversals(paymentStore[req.query.orderRef].paymentRef, payload);
    paymentStore[req.query.orderRef].status = "Refund Initiated";
    paymentStore[req.query.orderRef].modificationRef = response.pspReference;
    res.json(response);
    console.info("Refund initiated for ", response);
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.status(err.statusCode).json(err.message);
  }
});

app.post("/api/capturePayment", async (req, res) => {
  // here we sent the authorized or captured payment's reference which is [req.body.pspReference]
  // and also payload as merchantAccount, amount = {currency and value } and unique new reference id
  let paymentCaptureRequest = {
    merchantAccount: process.env.REACT_APP_ADYEN_MERCHANT_ACCOUNT, // required
    amount: { currency: "EUR", value: 1000 }, // value is 10€ in minor units
    reference: uuid(),
  };
  try {
    const { pspReference } = paymentStore[req.query.orderRef].paymentRef;
    console.log("pspReference", pspReference, paymentCaptureRequest);
    // we can get the order id from req.body and find the amount in paymentStore
    const response = await modification.captures(pspReference, paymentCaptureRequest);
    payment.status = "Captured";
    payment.paymentRef = response.pspReference;
    res.json(response);
    console.info("Capture initiated for", response);
  } catch (error) {
    console.error(`Error: ${error.message}, error code: ${error.errorCode}`);
    res.status(error.statusCode).json(error.message);
  }
});

// Receive webhook notifications
app.post("/api/webhook/notification", async (req, res) => {
  // get the notification request from POST body
  const notificationRequestItems = req.body.notificationItems;

  notificationRequestItems.forEach(({ NotificationRequestItem }) => {
    console.info("Received webhook notification", NotificationRequestItem, process.env.HMAC_KEY);
    console.log(
      "\n\n\nvalidator.validateHMACNotificationRequestItem, process.env.HMAC_KEY\n\n\n\n",
      validator.validateHMAC(NotificationRequestItem, process.env.HMAC_KEY)
    );
    try {
      if (validator.validateHMAC(NotificationRequestItem, process.env.HMAC_KEY)) {
        if (NotificationRequestItem.success === "true") {
          // Process the notification based on the eventCode
          if (NotificationRequestItem.eventCode === "AUTHORISATION") {
            const payment = paymentStore[NotificationRequestItem.merchantReference];
            if (payment) {
              payment.status = "Authorised";
              payment.paymentRef = NotificationRequestItem.pspReference;
              console.log("payment", payment);
            }
          } else if (NotificationRequestItem.eventCode === "CANCEL_OR_REFUND") {
            const payment = findPayment(NotificationRequestItem.pspReference);
            if (payment) {
              console.log("Payment found: ", JSON.stringify(payment));
              // update with additionalData.modification.action
              if (
                NotificationRequestItem.additionalData &&
                NotificationRequestItem.additionalData["modification.action"] &&
                "modification.action" in NotificationRequestItem.additionalData &&
                "refund" === NotificationRequestItem.additionalData["modification.action"]
              ) {
                payment.status = "Refunded";
              } else {
                payment.status = "Cancelled";
              }
            }
          } else if (NotificationRequestItem.eventCode === "CAPTURE") {
            console.log("Capture notification received", NotificationRequestItem);
            const payment = findPayment(NotificationRequestItem.pspReference);
            if (payment) {
              console.log("Payment found: ", JSON.stringify(payment));
              payment.status = "Captured";
            }
          } else {
            console.info("skipping non actionable webhook");
          }
        }
      } else {
        console.error("NotificationRequest with invalid HMAC key received");
      }
    } catch (err) {
      console.error("Error: ", err);
    }
  });

  res.send("[accepted]");
});
/* ################# end API ENDPOINTS ###################### */

/* ################# CLIENT ENDPOINTS ###################### */

// Handles any requests that doesn't match the above

/* ################# end CLIENT ENDPOINTS ###################### */

/* ################# UTILS ###################### */

function findPayment(pspReference) {
  const payments = Object.values(paymentStore).filter((v) => v.modificationRef === pspReference);
  if (payments.length < 0) {
    console.error("No payment found with that PSP reference");
  }
  return payments[0];
}

/* ################# end UTILS ###################### */

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
