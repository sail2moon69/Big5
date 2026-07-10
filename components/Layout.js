import Head from 'next/head'

export default ({ children }) => (
  <div className='container'>
    <Head>
      <meta name='viewport' content='initial-scale=0.8, maximum-scale=0.8, minimum-scale=0.8 user-scalable=no, width=device-width' />
      <link rel='icon' type='image/png' href='/static/rdsim-favicon.png' />
      <title>
        Big Five Test | rd-sim.de
      </title>
    </Head>
    {children}
    <style jsx global>
      {`
        :root {
          --rdsim-red: #e63946;
          --rdsim-orange: #f4a01c;
          --rdsim-navy: #0a0e1a;
          --rdsim-dark: #06090f;
          --rdsim-border: rgba(255, 255, 255, 0.08);
          --rdsim-text: #e8eaf0;
          --rdsim-muted: #7a8499;
        }
        body {
          background: var(--rdsim-dark);
          color: var(--rdsim-text);
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
          margin: 0;
          padding: 0;
          height: 100%;
          text-align: center;
        }
        div.fullscreen.fullscreen-enabled {
          background-color: black !important;
        }
        .container {
          display: grid;
          grid-template-areas:
            "header header header"
            ". content ."
            "footer footer footer";
          grid-template-columns: 3% 1fr 3%;
          grid-template-rows: auto 1fr auto;
        }
        .center {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        a {
          color: var(--rdsim-orange);
        }
        .rdsim-eyebrow {
          font-size: 0.7rem;
          letter-spacing: 0.35em;
          text-transform: uppercase;
          color: var(--rdsim-orange);
          margin-bottom: 0.8rem;
          text-align: center;
        }
        .rdsim-title {
          font-size: clamp(2rem, 5vw, 3rem);
          font-weight: 900;
          letter-spacing: -0.02em;
          text-transform: uppercase;
          color: #fff;
          text-align: center;
          margin: 0 0 1.5rem;
        }
        .rdsim-title .dot {
          color: var(--rdsim-red);
        }
        .rdsim-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--rdsim-border);
          padding: 1.5rem;
          margin: 10px auto;
          text-align: left;
          clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));
        }
        .rdsim-card h1, .rdsim-card h2 {
          font-size: 1.3rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 1rem;
          text-align: left;
        }
        .rdsim-card p, .rdsim-card li {
          color: var(--rdsim-muted);
          line-height: 1.7;
        }
        .rdsim-card a {
          color: var(--rdsim-orange);
        }
        .rdsim-card-light {
          background: #f7f7f8;
          border: 1px solid var(--rdsim-border);
          border-top: 3px solid var(--rdsim-red);
          color: #1a1a1a;
          padding: 1.5rem;
          margin: 10px auto;
          text-align: left;
          clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));
        }
        .rdsim-card-light h1, .rdsim-card-light h2 {
          font-size: 1.3rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 1rem;
          text-align: left;
          color: #1a1a1a;
        }
        .rdsim-card-light p, .rdsim-card-light li {
          color: #444;
          line-height: 1.7;
        }
        .rdsim-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.7rem 1.5rem;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          text-decoration: none;
          border: none;
          cursor: pointer;
          margin: 8px;
          transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
          clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
        }
        .rdsim-btn:hover {
          transform: translateY(-2px);
        }
        .rdsim-btn:focus {
          outline: 0;
        }
        .rdsim-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
        .rdsim-btn-primary {
          background: linear-gradient(135deg, var(--rdsim-red) 0%, #c0222e 100%);
          color: #fff;
          box-shadow: 0 8px 24px rgba(230, 57, 70, 0.35);
        }
        .rdsim-btn-primary:hover {
          box-shadow: 0 10px 30px rgba(230, 57, 70, 0.5);
        }
        .rdsim-btn-secondary {
          background: rgba(255, 255, 255, 0.06);
          color: var(--rdsim-text);
          border: 1px solid var(--rdsim-border);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
        }
        .rdsim-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .rdsim-btn-secondary.isActive {
          background: var(--rdsim-orange);
          color: var(--rdsim-dark);
        }
        .rdsim-input, .rdsim-select {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--rdsim-border);
          color: var(--rdsim-text);
          padding: 10px;
          font-size: 16px;
        }
        .rdsim-input:focus, .rdsim-select:focus {
          background: rgba(255, 255, 255, 0.07);
          border-color: var(--rdsim-orange);
          outline: 0;
        }
        .rdsim-input::placeholder {
          color: var(--rdsim-muted);
        }
        .rdsim-note {
          background: rgba(244, 160, 28, 0.08);
          border: 1px solid rgba(244, 160, 28, 0.35);
          border-left: 4px solid var(--rdsim-orange);
          padding: 1rem 1.25rem;
          margin: 1.2rem 0;
          text-align: left;
        }
        .rdsim-note p {
          margin: 0;
          color: var(--rdsim-text);
        }
        .rdsim-note strong {
          color: var(--rdsim-orange);
        }
        .rdsim-subhead {
          font-size: 1rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin: 1.5rem 0 0.7rem;
        }
        .rdsim-card .rdsim-subhead:first-child {
          margin-top: 0;
        }
        @media screen and (max-width: 800px) {
          .container {
            grid-template-columns: 3% 1fr 3%;
          }
        }
      `}
    </style>
  </div>
)
