export default function GlassCard({ children, className = "", as: Tag = "div", ...rest }) {
  return (
    <Tag className={`glass rounded-xl2 p-5 ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
