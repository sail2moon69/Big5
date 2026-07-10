import Link from 'next/link'

const Navbar = () => (
  <nav>
    <ul className='left'>
      <li>
        <a href='https://rd-sim.de' className='brand-link'>
          <img style={{ width: '28px' }} src='/static/rdsim-favicon.png' />
          <span className='brand'>rd-sim<span className='dot'>.de</span></span>
        </a>
      </li>
      <li className='sep'>&#8226;</li>
      <li>
        <Link href='/'>
          <a className='app-name'>Big Five Test</a>
        </Link>
      </li>
    </ul>
    <ul className='right'>
      <li>
        <Link href='/result'>
          <a>Result</a>
        </Link>
      </li>
      <li>
        <Link href='/compare'>
          <a>Compare</a>
        </Link>
      </li>
    </ul>
    <style jsx>{`
      nav {
        grid-area: header;
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        justify-content: space-between;
        background: var(--rdsim-navy);
        color: var(--rdsim-text);
        border-bottom: 1px solid var(--rdsim-border);
        margin-bottom: 20px;
        height: 60px;
      }
      ul {
        margin: 0;
        padding: 0;
        width: 100%;
        list-style-type: none;
        display: flex;
      }
      ul.left {
        justify-content: flex-start;
      }
      ul.right {
        justify-content: flex-end;
      }
      li {
        font-size: large;
        margin: 10px;
        align-self: center;
      }
      li.sep {
        color: var(--rdsim-muted);
        font-size: 16px;
      }
      .brand-link {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .brand {
        font-weight: 900;
        letter-spacing: -0.01em;
        text-transform: uppercase;
      }
      .brand .dot {
        color: var(--rdsim-red);
      }
      a {
        text-transform: uppercase;
        text-decoration: none;
        color: var(--rdsim-text);
        letter-spacing: 0.05em;
        font-size: 14px;
        font-weight: 700;
      }
      a:hover {
        color: var(--rdsim-orange);
      }
      @media screen and (max-width: 500px) {
        .app-name, .sep {
          display: none;
        }
      }
    `}
    </style>
  </nav>
)

export default Navbar
