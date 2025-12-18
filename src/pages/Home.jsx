import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
    const navigate = useNavigate();
    const [nombreSala, setNombreSala] = useState("");

    function crearSala() {
        const id = Math.random().toString(36).substring(2, 8).toUpperCase();
        navigate(`/sala/${id}`);
    }

    function entrarSala() {
        if (nombreSala.trim() === "") return;
        navigate(`/sala/${nombreSala}`);
    }

    return (
        <div className="container">
            <div className="card">
                <h1 style={{ marginBottom: 20, textAlign: "center" }}>
                    Planning Poker
                </h1>

                <button className="btn" style={{ width: "100%", marginBottom: 20 }} onClick={crearSala}>
                    Crear nueva sala
                </button>

                <input
                    className="input"
                    placeholder="Código de sala (ej: ABC123)"
                    onChange={(e) => setNombreSala(e.target.value.toUpperCase())}
                />

                <button className="btn" style={{ width: "100%" }} onClick={entrarSala}>
                    Unirme a sala
                </button>
            </div>
        </div>
    );
}
