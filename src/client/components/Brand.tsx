import styles from './Brand.module.css';

type BrandProps = {
    className?: string | undefined;
    large?: boolean;
    showName?: boolean;
};

export default function Brand({className = '', large = false, showName = true}: BrandProps) {
    const logoClassName = `${styles.logo} ${large ? styles.large : ''}`.trim();
    const brandClassName = `${styles.brand} ${className}`.trim();

    return (
        <div className={brandClassName}>
            <div className={logoClassName} aria-hidden="true" />
            {showName && <span>MAX Chat</span>}
        </div>
    );
}
