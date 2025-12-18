export default function PlayerCard({ value, onSelect }) {
    return (
        <button
            onClick={() => onSelect(value)}
            style={{
                padding: "20px",
                margin: "10px",
                width: "70px",
                height: "100px",
                fontSize: "24px",
                borderRadius: "12px",
                border: "1px solid #d1d5db",
                background: "white",
                cursor: "pointer",
                boxShadow: "0 4px 8px rgba(0,0,0,0.05)",
                transition: "0.2s",
            }}
        >
            {value}
        </button>
    );
}
