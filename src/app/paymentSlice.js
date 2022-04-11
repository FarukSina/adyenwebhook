import { createSlice } from "@reduxjs/toolkit";

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
  console.log("type", type);
  if (type === "dropin") {
    allowedPaymentMethods = ["card", "paypal"];
  }
  console.log("allowedPaymentMethods2", allowedPaymentMethods);
  const response = await fetch(`https://adyenheroku2.herokuapp.com/api/sessions?type=${type}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: allowedPaymentMethods ? JSON.stringify({ allowedPaymentMethods }) : null,
  });
  dispatch(paymentSession([await response.json(), response.status]));
};

export const getPaymentDataStore = () => async (dispatch) => {
  const response = await fetch("https://adyenheroku2.herokuapp.com/api/getPaymentDataStore");
  dispatch(paymentDataStore([await response.json(), response.status]));
};

export const cancelOrRefundPayment = (orderRef) => async (dispatch) => {
  await fetch(`https://adyenheroku2.herokuapp.com/api/cancelOrRefundPayment?orderRef=${orderRef}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  dispatch(getPaymentDataStore());
};

export const capturePayment = (orderRef) => async (dispatch) => {
  await fetch(`https://adyenheroku2.herokuapp.com/api/capturePayment?orderRef=${orderRef}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  dispatch(getPaymentDataStore());
};

export default slice.reducer;
