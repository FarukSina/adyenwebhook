import { createSlice } from "@reduxjs/toolkit";
import { nanoid } from "nanoid";

export const slice = createSlice({
  name: "payment",
  initialState: {
    error: "",
    session: null,
    orderRef: null,
    paymentDataStoreRes: null,
    config: {
      storePaymentMethod: true,
      paymentMethodsConfiguration: {
        ideal: {
          showImage: true,
        },
        card: {
          hasHolderName: true,
          holderNameRequired: true,
          name: "Credit or debit card",
          amount: {
            value: 1000, // 10€ in minor units
            currency: "EUR",
          },
        },
      },
      locale: "en_CA",
      showPayButton: true,
      clientKey: process.env.REACT_APP_ADYEN_CLIENT_KEY,
      environment: "test",
    },
  },
  reducers: {
    paymentSession: (state, action) => {
      const [res, status] = action.payload;
      if (status >= 300) {
        state.error = res;
      } else {
        [state.session, state.orderRef] = res;
      }
    },
    paymentDataStore: (state, action) => {
      const [res, status] = action.payload;
      if (status >= 300) {
        state.error = res;
      } else {
        state.paymentDataStoreRes = res;
      }
    },
  },
});

export const { paymentSession, paymentDataStore } = slice.actions;

export const initiateCheckout = (type) => async (dispatch) => {
  let allowedPaymentMethods = null;
  let split = null;
  let body = null;
  console.log("type", type);
  if (type === "dropin") {
    allowedPaymentMethods = ["card", "paypal"];
  }
  if (type === "card") {
    split = [
      {
        amount: {
          value: 900,
        },
        type: "MarketPlace",
        account: "HttpsgithubcomFarukSina_FARUKKAYA_TEST",
        reference: nanoid(),
      },
      {
        amount: {
          value: 100,
        },
        type: "Commission",
        reference: nanoid(),
      },
    ];
  }
  console.log("allowedPaymentMethods2", allowedPaymentMethods);
  if (allowedPaymentMethods) {
    body = { allowedPaymentMethods };
  }
  if (split) {
    body = { ...body, split };
  }
  console.log("body", body);
  const response = await fetch(`https://farukwebhooktest.herokuapp.com/api/sessions?type=${type}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...body }),
  });
  dispatch(paymentSession([await response.json(), response.status]));
};

export const getPaymentDataStore = () => async (dispatch) => {
  const response = await fetch("https://farukwebhooktest.herokuapp.com/api/getPaymentDataStore");
  dispatch(paymentDataStore([await response.json(), response.status]));
};

export const cancelOrRefundPayment = (orderRef) => async (dispatch) => {
  await fetch(`https://farukwebhooktest.herokuapp.com/api/cancelOrRefundPayment?orderRef=${orderRef}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  dispatch(getPaymentDataStore());
};

export const capturePayment = (orderRef, value) => async (dispatch) => {
  await fetch(`https://farukwebhooktest.herokuapp.com/api/capturePayment?orderRef=${orderRef}&value=${value}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  dispatch(getPaymentDataStore());
};

export const cancelPayment = (orderRef) => async (dispatch) => {
  await fetch(`https://farukwebhooktest.herokuapp.com/api/cancelPayment?orderRef=${orderRef}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  dispatch(getPaymentDataStore());
};

export const refundPayment = (orderRef, value) => async (dispatch) => {
  await fetch(`https://farukwebhooktest.herokuapp.com/api/refundPayment?orderRef=${orderRef}&value=${value}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  dispatch(getPaymentDataStore());
};

export default slice.reducer;
