import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase/config";
import {
    doc,
    setDoc,
    getDoc,
    getDocs,
    onSnapshot,
    collection,
    addDoc,
    deleteDoc,
    serverTimestamp,
} from "firebase/firestore";

export default function Sala() {
    const { id } = useParams();

    const [nombre, setNombre] = useState(localStorage.getItem("nombreJugador") || "");
    const [jugadorId, setJugadorId] = useState(localStorage.getItem("jugadorId") || null);
    const [jugadores, setJugadores] = useState([]);
    const [estadoSala, setEstadoSala] = useState("votando");
    const [soyLider, setSoyLider] = useState(false);
    const [liderId, setLiderId] = useState(null);
    const [miVoto, setMiVoto] = useState(null);

    // Verificar si la sala existe al entrar
    useEffect(() => {
        async function verificarSala() {
            const ref = doc(db, "salas", id);
            const snap = await getDoc(ref);

            if (!snap.exists()) {
                // Crear sala si no existe
                await setDoc(ref, {
                    estado: "votando",
                    liderId: null,
                    ronda: 1,
                });
            }
        }

        verificarSala();
    }, [id]);

    // Verificar si el jugador almacenado aún existe
    useEffect(() => {
        async function verificarJugador() {
            const jugadorIdLocal = localStorage.getItem("jugadorId");
            
            if (jugadorIdLocal) {
                const jugadorRef = doc(db, "salas", id, "jugadores", jugadorIdLocal);
                const jugadorSnap = await getDoc(jugadorRef);

                // Si el jugador ya no existe en Firebase, limpiar localStorage
                if (!jugadorSnap.exists()) {
                    localStorage.removeItem("jugadorId");
                    localStorage.removeItem("nombreJugador");
                    setJugadorId(null);
                    setNombre(localStorage.getItem("nombreJugador") || "");
                }
            }
        }

        verificarJugador();
    }, [id]);

    // Escuchar datos de la sala (estado y líder)
    useEffect(() => {
        const salaRef = doc(db, "salas", id);

        const unsub = onSnapshot(salaRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setEstadoSala(data.estado);
                setLiderId(data.liderId);
                setSoyLider(data.liderId === jugadorId);
            }
        });

        return () => unsub();
    }, [id, jugadorId]);

    // Escuchar jugadores en tiempo real
    useEffect(() => {
        const ref = collection(db, "salas", id, "jugadores");

        const unsub = onSnapshot(ref, (snap) => {
            const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setJugadores(lista);

            // Sincronizar nombre del jugador actual
            if (jugadorId) {
                const miJugador = lista.find((j) => j.id === jugadorId);
                if (miJugador && miJugador.nombre !== nombre) {
                    setNombre(miJugador.nombre);
                    localStorage.setItem("nombreJugador", miJugador.nombre);
                }
                // Si mi jugador ya no existe, limpiar
                if (!miJugador) {
                    localStorage.removeItem("jugadorId");
                    localStorage.removeItem("nombreJugador");
                    setJugadorId(null);
                    setNombre("");
                }
            }
        });

        return () => unsub();
    }, [id, jugadorId, nombre]);

    // Actualizar última actividad del jugador
    useEffect(() => {
        if (!jugadorId) return;

        const jugadorRef = doc(db, "salas", id, "jugadores", jugadorId);

        // Actualizar al montar
        setDoc(jugadorRef, { ultimaActividad: serverTimestamp() }, { merge: true });

        // Actualizar cada 30 segundos
        const intervalo = setInterval(() => {
            setDoc(jugadorRef, { ultimaActividad: serverTimestamp() }, { merge: true });
        }, 30000);

        // Limpiar al desmontar o cerrar
        const handleBeforeUnload = async () => {
            await deleteDoc(jugadorRef);
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            clearInterval(intervalo);
            window.removeEventListener("beforeunload", handleBeforeUnload);
            // Intentar eliminar el jugador al desmontar
            deleteDoc(jugadorRef).catch(() => {});
        };
    }, [id, jugadorId]);

    // Limpiar jugadores inactivos (más de 2 minutos sin actividad)
    useEffect(() => {
        if (!jugadorId) return;

        const intervalo = setInterval(async () => {
            const jugadoresRef = collection(db, "salas", id, "jugadores");
            const snap = await getDocs(jugadoresRef);
            const ahora = Date.now();

            for (const jugadorDoc of snap.docs) {
                const data = jugadorDoc.data();
                const ultimaActividad = data.ultimaActividad?.toMillis() || 0;
                const tiempoInactivo = ahora - ultimaActividad;

                // Si lleva más de 2 minutos inactivo y no soy yo
                if (tiempoInactivo > 120000 && jugadorDoc.id !== jugadorId) {
                    // Si era el líder, asignar nuevo líder antes de eliminarlo
                    if (jugadorDoc.id === liderId) {
                        const jugadoresRestantes = snap.docs.filter(j => j.id !== jugadorDoc.id);
                        if (jugadoresRestantes.length > 0) {
                            const salaRef = doc(db, "salas", id);
                            await setDoc(salaRef, { liderId: jugadoresRestantes[0].id }, { merge: true });
                        }
                    }
                    
                    await deleteDoc(doc(db, "salas", id, "jugadores", jugadorDoc.id));
                }
            }
        }, 60000); // Revisar cada minuto

        return () => clearInterval(intervalo);
    }, [id, jugadorId, liderId]);

    // Registrar jugador
    async function entrarASala() {
        const nombreLimpio = nombre.trim();
        if (nombreLimpio === "") return;

        const jugadoresRef = collection(db, "salas", id, "jugadores");
        const snap = await getDocs(jugadoresRef);

        // Si el nombre ya existe → usar ese jugador
        const existente = snap.docs.find((j) => j.data().nombre === nombreLimpio);

        if (existente) {
            setJugadorId(existente.id);
            setNombre(existente.data().nombre);
            setMiVoto(existente.data().voto);
            localStorage.setItem("jugadorId", existente.id);
            localStorage.setItem("nombreJugador", existente.data().nombre);
            
            // Actualizar última actividad
            const jugadorRef = doc(db, "salas", id, "jugadores", existente.id);
            await setDoc(jugadorRef, { ultimaActividad: serverTimestamp() }, { merge: true });
            
            return;
        }

        // Crear nuevo jugador
        const jugadorRef = await addDoc(jugadoresRef, {
            nombre: nombreLimpio,
            voto: null,
            ultimaActividad: serverTimestamp(),
        });

        setJugadorId(jugadorRef.id);
        setNombre(nombreLimpio);
        setMiVoto(null);
        localStorage.setItem("jugadorId", jugadorRef.id);
        localStorage.setItem("nombreJugador", nombreLimpio);

        // Si la sala no tiene líder → este será el líder
        const salaRef = doc(db, "salas", id);
        const salaSnap = await getDoc(salaRef);

        if (!salaSnap.data().liderId) {
            await setDoc(salaRef, { liderId: jugadorRef.id }, { merge: true });
        }
    }

    // Registrar voto
    async function registrarVoto(valor) {
        if (!jugadorId || estadoSala === "revelado") return;

        setMiVoto(valor);

        const jugadorRef = doc(db, "salas", id, "jugadores", jugadorId);

        await setDoc(
            jugadorRef,
            { voto: valor, ultimaActividad: serverTimestamp() },
            { merge: true }
        );
    }

    // LIDER → Revelar votos
    async function revelarVotos() {
        const salaRef = doc(db, "salas", id);
        await setDoc(salaRef, { estado: "revelado" }, { merge: true });
    }

    // LIDER → Reiniciar ronda
    async function reiniciarRonda() {
        // Borrar votos
        for (const j of jugadores) {
            const jugadorRef = doc(db, "salas", id, "jugadores", j.id);
            await setDoc(jugadorRef, { voto: null }, { merge: true });
        }

        // Volver a modo votación
        const salaRef = doc(db, "salas", id);
        await setDoc(
            salaRef,
            { estado: "votando", ronda: Date.now() },
            { merge: true }
        );

        setMiVoto(null);
    }

    function calcularEstadisticas(jugadores) {
        const votosValidos = jugadores
            .map(j => j.voto)
            .filter(v => v !== null && v !== "?")
            .map(Number);

        if (votosValidos.length === 0) return null;

        const suma = votosValidos.reduce((a, b) => a + b, 0);
        const promedio = (suma / votosValidos.length).toFixed(1);
        const min = Math.min(...votosValidos);
        const max = Math.max(...votosValidos);

        const consenso = votosValidos.every(v => v === votosValidos[0]);

        return { promedio, min, max, consenso };
    }

    const estadisticas =
        estadoSala === "revelado"
            ? calcularEstadisticas(jugadores)
            : null;

    // Si no estamos registrados aún
    if (!jugadorId) {
        return (
            <div className="container">
                <div className="card">
                    <h2>Sala: {id}</h2>
                    <p>Ingresa tu nombre para unirte:</p>

                    <input
                        className="input"
                        placeholder="Tu nombre"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                    />

                    <button className="btn" style={{ width: "100%" }} onClick={entrarASala}>
                        Entrar
                    </button>

                    <h3 style={{ marginTop: 20 }}>Jugadores en sala:</h3>
                    <ul>
                        {jugadores.map((j) => (
                            <li key={j.id}>{j.nombre}</li>
                        ))}
                    </ul>
                </div>
            </div>
        );
    }

    // Vista cuando ya estamos dentro
    return (
        <div className="container">
            <div className="card">
                <h2>Sala: {id}</h2>
                <p>Bienvenido, {nombre}</p>

                <h3 style={{ marginTop: 20 }}>Jugadores conectados:</h3>
                
                <div style={{ 
                    display: "flex", 
                    flexWrap: "wrap", 
                    gap: "15px",
                    marginTop: "15px" 
                }}>
                    {jugadores.map((j, index) => (
                        <div 
                            key={j.id}
                            style={{
                                perspective: "1000px",
                                width: "120px",
                            }}
                        >
                            <div
                                style={{
                                    position: "relative",
                                    width: "100%",
                                    height: "160px",
                                    transition: "transform 0.6s",
                                    transformStyle: "preserve-3d",
                                    transform: estadoSala === "revelado" ? "rotateY(180deg)" : "rotateY(0deg)",
                                    animation: estadoSala === "revelado" ? `flipCard 0.6s ease-in-out ${index * 0.1}s` : "none",
                                }}
                            >
                                {/* Cara frontal - carta boca abajo */}
                                <div
                                    style={{
                                        position: "absolute",
                                        width: "100%",
                                        height: "100%",
                                        backfaceVisibility: "hidden",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: j.voto !== null 
                                            ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                                            : "linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%)",
                                        borderRadius: "12px",
                                        padding: "10px",
                                        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                                    }}
                                >
                                    <div style={{ 
                                        fontSize: "12px", 
                                        fontWeight: "bold", 
                                        color: "white",
                                        textAlign: "center",
                                        marginBottom: "8px",
                                    }}>
                                        {j.nombre}
                                        {j.id === liderId && <span> 👑</span>}
                                    </div>
                                    <div style={{
                                        fontSize: "40px",
                                        color: "white",
                                        fontWeight: "bold"
                                    }}>
                                        {j.voto !== null ? "🎴" : "⏳"}
                                    </div>
                                </div>

                                {/* Cara trasera - carta revelada */}
                                <div
                                    style={{
                                        position: "absolute",
                                        width: "100%",
                                        height: "100%",
                                        backfaceVisibility: "hidden",
                                        transform: "rotateY(180deg)",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: j.voto !== null
                                            ? "linear-gradient(135deg, #b9b5b9ff 0%, #f5576c 100%)"
                                            : "linear-gradient(135deg, #fecaca 0%, #ef4444 100%)",
                                        borderRadius: "12px",
                                        padding: "10px",
                                        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                                    }}
                                >
                                    <div style={{ 
                                        fontSize: "12px", 
                                        fontWeight: "bold", 
                                        color: "white",
                                        textAlign: "center",
                                        marginBottom: "8px",
                                    }}>
                                        {j.nombre}
                                        {j.id === liderId && <span> 👑</span>}
                                    </div>
                                    <div style={{
                                        fontSize: "48px",
                                        color: "white",
                                        fontWeight: "bold"
                                    }}>
                                        {j.voto !== null ? j.voto : "❌"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <style>
                    {`
                        @keyframes flipCard {
                            0% {
                                transform: rotateY(0deg);
                            }
                            100% {
                                transform: rotateY(180deg);
                            }
                        }
                    `}
                </style>

                {estadoSala === "revelado" && estadisticas && (
                    <div
                        style={{
                            marginTop: 20,
                            padding: 15,
                            borderRadius: 12,
                            background: "#f1f5f9",
                            textAlign: "left",
                        }}
                    >
                        <h3 style={{ marginBottom: 15 }}>📊 Resultado de la ronda</h3>

                        <p style={{ marginBottom: 10 }}>
                            Promedio: <strong>{estadisticas.promedio}</strong>
                        </p>
                        <p style={{ marginBottom: 10 }}>
                            Mínimo: <strong>{estadisticas.min}</strong>
                        </p>
                        <p style={{ marginBottom: 10 }}>
                            Máximo: <strong>{estadisticas.max}</strong>
                        </p>

                        <p style={{ marginTop: 15 }}>
                            {estadisticas.consenso ? (
                                <span style={{ color: "green", fontWeight: "bold" }}>
                                    ✅ Consenso alcanzado
                                </span>
                            ) : (
                                <span style={{ color: "#b45309", fontWeight: "bold" }}>
                                    ❌ No hay consenso
                                </span>
                            )}
                        </p>
                    </div>
                )}


                <h3 style={{ marginTop: 25 }}>Selecciona tu carta:</h3>

                <div style={{ display: "flex", flexWrap: "wrap" }}>
                    {["1", "2", "3", "5", "8", "13", "21", "?"].map((carta) => {
                        const seleccionada = miVoto === carta;

                        return (
                            <button
                                key={carta}
                                onClick={() => registrarVoto(carta)}
                                style={{
                                    padding: "20px",
                                    margin: "10px",
                                    width: "70px",
                                    height: "100px",
                                    fontSize: "24px",
                                    borderRadius: "12px",
                                    cursor: "pointer",
                                    transition: "0.2s",
                                    border: seleccionada ? "3px solid #3b82f6" : "1px solid #d1d5db",
                                    background: seleccionada ? "#e8f0ff" : "white",
                                    transform: seleccionada ? "scale(1.05)" : "scale(1)",
                                    boxShadow: seleccionada
                                        ? "0 6px 14px rgba(59,130,246,0.3)"
                                        : "0 4px 8px rgba(0,0,0,0.05)",
                                }}
                            >
                                {carta}
                            </button>
                        );
                    })}
                </div>

                {soyLider && (
                    <div style={{ marginTop: 20 }}>
                        <button className="btn" onClick={revelarVotos}>
                            Revelar votos
                        </button>

                        <button
                            className="btn"
                            style={{ marginLeft: 10 }}
                            onClick={reiniciarRonda}
                        >
                            Reiniciar ronda
                        </button>
                    </div>
                )}

                <p style={{ marginTop: 20, fontStyle: "italic" }}>
                    Tu voto se guarda automáticamente.
                </p>
            </div>
        </div>
    );
}
