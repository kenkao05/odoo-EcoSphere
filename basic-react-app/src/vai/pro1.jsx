
import { useRef } from 'react';
import './pro1.css'; // Apni styling file ko import kar rahe hain

// ==========================================
// 1. NESTED COMPONENTS DEFINITION
// ==========================================

// --- Component 1: Navbar ---
const Navbar = ({ onHomeClick, onAboutClick }) => (
  <header className="navbar">
    <div className="logo-container">
      <span className="logo-icon">🔥</span>
      <div className="logo-text">
        <h1>HARMONI</h1>
        <p>EVENT MANAGEMENT</p>
      </div>
    </div>
    
    <nav className="nav-links">
      <button onClick={onHomeClick} className="nav-link-btn">HOME</button>
      <button onClick={onAboutClick} className="nav-link-btn active">ABOUT</button>
      <a href="#events" className="nav-item">EVENTS</a>
      <a href="#gallery" className="nav-item">GALLERY</a>
      <a href="#contact" className="nav-item">CONTACT</a>
    </nav>

    <div className="user-profile">
      <div className="avatar">SU</div>
      <span>spark user</span>
    </div>
  </header>
);

// --- Component 2: AboutSection (Image 1 Elements) ---
const AboutSection = () => (
  <>
    <section className="hero-banner-section">
      <div className="hero-overlay">
        <div className="hero-center-text">
          <h4>ALL YOU NEED TO</h4>
          <h3>KNOW</h3>
          <h1 className="yellow-title-text">ABOUT</h1>
          <h2>HARMONI</h2>
          <p className="breadcrumb">
            <span className="bold-white">Home</span> | <span className="fade-gray">About Us</span>
          </p>
        </div>
      </div>
    </section>

    <main className="about-info-section">
      <div className="info-column main-headline">
        <p className="small-tag">We are harmoni</p>
        <h2>No.1 Events Management</h2>
        <button className="get-started-link">Ger Started!</button>
      </div>

      <div className="info-column">
        <div className="column-title-wrapper">
          <h3>our mission</h3>
          <span className="yellow-dash-line"></span>
        </div>
        <p className="description-paragraph">
          Lorem ipsum dolor site amet the best consectuer adipiscing elites sed diam 
          nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat 
          volutpat insignia the consectuer adipiscing elit.
        </p>
        <p className="bold-footer-text">Lorem ipsum dolor site amet the best</p>
      </div>

      <div className="info-column">
        <div className="column-title-wrapper">
          <h3>our vision</h3>
          <span className="yellow-dash-line"></span>
        </div>
        <p className="description-paragraph">
          Lorem ipsum dolor site amet the best consectuer adipiscing elites sed diam 
          nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat 
          volutpat insignia the consectuer adipiscing elit.
        </p>
        <p className="bold-footer-text">Lorem ipsum dolor site amet the best</p>
      </div>
    </main>
  </>
);

// --- Component 3: HomeFeaturesSection (Image 2 Elements) ---
const HomeFeaturesSection = ({ forwardRef }) => (
  <section ref={forwardRef} className="home-features-section" id="home">
    <div className="features-grid">
      <div className="feature-col-left">
        <h2 className="pink-main-text">
          Harmony Event Management firm & Wedding Planner is a group of creative minds 
          who would like to make weddings, birthday & any kind of events courteous & 
          a better place for our clients to celebrate important moment of their lives...
        </h2>
        <p className="request-access-btn">Request Early Access to get Started</p>
      </div>

      <div className="feature-col-middle">
        <div className="service-list-item">
          <span className="pink-dash-line"></span>
          <h3>Photography</h3>
        </div>
        <div className="service-list-item">
          <span className="pink-dash-line"></span>
          <h3>cinematography or Videography service</h3>
        </div>
        <div className="service-list-item">
          <span className="pink-dash-line"></span>
          <h3>Full venue Decoration Service</h3>
        </div>
        <div className="service-list-item">
          <span className="pink-dash-line"></span>
          <h3>Home Decoration</h3>
        </div>
      </div>

      <div className="feature-col-right">
        <p className="blue-info-text">A team of 5 talented Photographers are ready to snap the best moments of your ceremony</p>
        <p className="blue-info-text">Creative full HD 1080p Video, a different space of your ceremoniey</p>
        <p className="blue-info-text">A Blend of out-of-box ideas to decore your precious date</p>
        <p className="blue-info-text italic-text">just call us and get total event solution under one roof..</p>
      </div>
    </div>

    <div className="pink-cta-banner-card">
      <div className="cta-banner-left">
        <span className="cta-mini-label">Request Early Access to get Started</span>
        <h3>Registered Today & start exploring the endless possibilities.</h3>
      </div>
      <button className="black-action-btn">GET STARTED</button>
    </div>
  </section>
);


// ==========================================
// 2. MAIN APPLICATION (COMBINING PAGES)
// ==========================================
function App() {
  const homeSectionRef = useRef(null);

  const scrollToHome = () => {
    homeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToAbout = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-container">
      {/* Shared Layout Header */}
      <Navbar onHomeClick={scrollToHome} onAboutClick={scrollToAbout} />

      {/* Page 1 Layout Block */}
      <div className="page-view">
        <AboutSection />
      </div>

      {/* Page 2 Layout Block */}
      <div className="page-view">
        <HomeFeaturesSection forwardRef={homeSectionRef} />
      </div>
    </div>
  );
}

export default App;