import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getPaymentDataStore, capturePayment } from "../../app/paymentSlice";

export const CaptureContainer = () => (
  <main className="preview-page">
    <section className="cart">
      <h2>Payment Transactions</h2>
      <div className="order-summary">
        <CaptureList />
      </div>
    </section>
  </main>
);

const CaptureList = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(getPaymentDataStore());
  }, [dispatch]);

  const paymentDataStore = useSelector((state) => state.payment.paymentDataStoreRes);

  if (!paymentDataStore) {
    return <p className="m-5">Loading</p>;
  }

  const validPayments = paymentDataStore ? Object.values(paymentDataStore).filter((val) => val.paymentRef) : [];
  console.log("validPayments", validPayments);
  if (validPayments.length === 0) {
    return <p className="m-5">Please make a payment first</p>;
  }

  return (
    <ul className="order-summary-list">
      {validPayments.map((val) => (
        <CaptureItem payment={val} />
      ))}
    </ul>
  );
};

const CaptureItem = ({ payment }) => {
  const dispatch = useDispatch();
  const [value, setValue] = useState(100);
  return (
    <li className="order-summary-list-list-item" key={payment.reference}>
      <p className="m-auto">Ref: {payment.paymentRef}</p>
      <p className="m-auto">{payment.status}</p>
      <p className="m-auto">
        {payment.amount.value / 100} {/* adjust for minor units */}
        {payment.amount.currency}
      </p>
      {payment.status === "Authorised" || payment.status === "Capture Initiated" ? (
        <div>
          <button className="button btn-info w-25 my-4" onClick={() => dispatch(capturePayment(payment.reference, value))}>
            Capture
          </button>
          <input type="text" onChange={(e) => setValue(e.target.value)} />
        </div>
      ) : null}
    </li>
  );
};
