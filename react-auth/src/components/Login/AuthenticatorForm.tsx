import axios from 'axios';
import { ReactElement, SyntheticEvent, useEffect, useState } from 'react';
import qrcode from 'qrcode';

type P = {
  loginData: {
    id: number;
    secret?: string;
    otpauth_url?: string;
  };
  success: Function;
};

export const AuthenticatorForm = (props: P) => {
  const [code, setCode] = useState('');
  const [img, setImg] = useState<ReactElement | null>(null);

  useEffect(() => {
    if (props.loginData.otpauth_url) {
      qrcode.toDataURL(props.loginData.otpauth_url, (err, data) => {
        setImg(<img src={data} style={{ width: '100%' }} alt="" />);
      });
    }
  }, [props.loginData.otpauth_url]);

  const submit = async (e: SyntheticEvent) => {
    e.preventDefault();

    const { data, status } = await axios.post(
      'two-factor',
      {
        ...props.loginData,
        code
      },
      { withCredentials: true }
    );

    axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;

    if (status === 200) {
      props.success();
    }
  };

  return (
    <>
      <form onSubmit={submit}>
        <h1 className="h3 mb-3 fw-normal">
          Please insert your authenticator code
        </h1>

        <div className="form-floating">
          <input
            className="form-control"
            id="floatingInput"
            placeholder="6 digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <label htmlFor="floatingInput">6 digit code</label>
        </div>

        <button className="btn btn-primary w-100 mt-3 py-2" type="submit">
          Submit
        </button>
      </form>
      {img}
    </>
  );
};
