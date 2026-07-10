export default ({ eyebrow, title, slogan }) => (
  <div className='hero'>
    <div className='hero-bg' />
    <div className='hero-overlay' />
    <div className='hero-content'>
      {eyebrow ? <div className='rdsim-eyebrow'>{eyebrow}</div> : null}
      <h1 className='rdsim-title hero-title'>{title}<span className='dot'>.</span></h1>
      {slogan ? <p className='hero-slogan'>{slogan}</p> : null}
    </div>
    <style jsx>
      {`
        .hero {
          position: relative;
          min-height: 380px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .hero-bg {
          position: absolute;
          inset: 0;
          background: url('/static/hero.jpg') center 30% / cover no-repeat;
          transform: scale(1.05);
        }
        .hero-overlay {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse at center, transparent 20%, rgba(6, 9, 15, 0.65) 100%),
            linear-gradient(
              to bottom,
              rgba(6, 9, 15, 0.45) 0%,
              rgba(6, 9, 15, 0.35) 35%,
              rgba(6, 9, 15, 0.75) 75%,
              rgba(6, 9, 15, 0.97) 100%
            );
        }
        .hero-content {
          position: relative;
          z-index: 2;
          padding: 2rem;
        }
        .hero-title {
          margin-bottom: 0;
          text-shadow: 0 0 60px rgba(230, 57, 70, 0.35);
        }
        .hero-slogan {
          margin-top: 0.9rem;
          font-size: 0.95rem;
          font-weight: 400;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          text-align: center;
          color: var(--rdsim-muted);
        }
      `}
    </style>
  </div>
)
