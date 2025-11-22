import React from "react";

type IconProps = {
  Svg: React.FC<React.SVGProps<SVGSVGElement>>;
  active?: boolean;
};

type SliderProps = {
  label: string;
  value: string;
};

const Icon: React.FC<IconProps> = ({ Svg, active = false }) => (
  <div className={`viewer-icon${active ? " active" : ""}`}>
    <Svg />
  </div>
);

const GridIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="3" y1="9" x2="21" y2="9"></line>
        <line x1="3" y1="15" x2="21" y2="15"></line>
        <line x1="9" y1="3" x2="9" y2="21"></line>
        <line x1="15" y1="3" x2="15" y2="21"></line>
    </svg>
);

const MarkerIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
    </svg>
);

const EyeIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
);

const PlaneIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.3 21.2L4.8 17.7 2.9 5.2l15.5 3.5 1.9 12.5zM8.3 14.2l5.5-2.5"></path>
    </svg>
);

const PersonIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
    </svg>
);

const CarIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 16H9m12 0a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7zM5 9V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4"></path>
        <circle cx="6.5" cy="16.5" r="1.5"></circle>
        <circle cx="17.5" cy="16.5" r="1.5"></circle>
    </svg>
);

const Slider: React.FC<SliderProps> = ({ label, value }) => (
  <div className="my-4">
    <div className="flex justify-between items-center mb-2">
      <label className="text-xs uppercase tracking-widest text-blue-grey-muted">{label}</label>
      <span className="text-white">{value}</span>
    </div>
    <input
      type="range"
      className="w-full h-1 bg-dark-grey rounded-lg appearance-none cursor-pointer"
      style={
        {
          "--thumb-color": "#FF6B4A",
        } as React.CSSProperties
      }
    />
  </div>
);

const ViewerSettingsPanel = () => {
  return (
    <div className="viewer-wrapper">
      <div className="viewer-panel">
        <div className="viewer-icons">
          <Icon Svg={GridIcon} />
          <Icon Svg={MarkerIcon} />
          <Icon Svg={EyeIcon} />
          <Icon Svg={PlaneIcon} active={true} />
          <Icon Svg={PersonIcon} />
          <Icon Svg={CarIcon} />
        </div>

        <h2 className="viewer-title">FREE-FLY</h2>

        <div>
          <Slider label="Field of View" value="60°" />
          <Slider label="Aperture" value="1.2" />
          <Slider label="Focal Distance" value="1.5" />
          <Slider label="Speed" value="x125" />
        </div>

        <div className="aspect-block">
          <h3 className="section-title">ASPECT RATIO</h3>
          <Slider label="HEIGHT" value="12.34" />
          <Slider label="WIDTH" value="23.76" />
        </div>

        <button className="cta-button">AUTO FOCUS</button>
      </div>
    </div>
  );
};

export default ViewerSettingsPanel;
