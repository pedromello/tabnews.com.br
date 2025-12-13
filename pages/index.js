import { useState, useEffect } from 'react';

function Home() {
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        const updateSeconds = () => {
            const startDate = new Date(1374516000 * 1000);
            const now = new Date();
            const diff = (now - startDate) / 1000;
            setSeconds(Math.floor(diff));
        };

        updateSeconds();
        const interval = setInterval(updateSeconds, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="container">
            <main className="main">
                <h1 className="title">
                    <span className="name">Hanelle </span>, muito obrigado por sempre acreditar em mim e me apoiar.
                </h1>
                <p className="subtitle">
                    A cada segundo que passa eu te amo mais.
                </p>
                <div className="counter-container">
                    <div className="counter">
                        {seconds.toLocaleString()}
                    </div>
                    <div className="label">segundos aumentando meu <span className="name">amor</span> por você</div>
                </div>
            </main>

            <style jsx global>{`
                html,
                body {
                    padding: 0;
                    margin: 0;
                    font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto,
                        Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue,
                        sans-serif;
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                    color: #fff;
                    min-height: 100vh;
                }

                * {
                    box-sizing: border-box;
                }
            `}</style>

            <style jsx>{`
                .container {
                    min-height: 100vh;
                    padding: 0 0.5rem;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                }

                .main {
                    padding: 5rem 0;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    text-align: center;
                }

                .title {
                    margin: 0;
                    line-height: 1.15;
                    font-size: 3.5rem;
                    background: linear-gradient(to right, #60a5fa, #34d399);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    max-width: 800px;
                    font-weight: 800;
                    letter-spacing: -0.05em;
                }

                .name {
                    background: linear-gradient(to right, #f43f5e, #fb7185);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .subtitle {
                    margin: 2rem 0;
                    line-height: 1.5;
                    font-size: 1.5rem;
                    color: #94a3b8;
                    max-width: 600px;
                }

                .counter-container {
                    margin-top: 2rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    background: rgba(255, 255, 255, 0.05);
                    padding: 2rem 4rem;
                    border-radius: 20px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
                    transition: transform 0.3s ease;
                }

                .counter-container:hover {
                    transform: scale(1.02);
                    border-color: rgba(255, 255, 255, 0.2);
                }

                .counter {
                    font-size: 4rem;
                    font-weight: 700;
                    color: #f8fafc;
                    font-variant-numeric: tabular-nums;
                    line-height: 1;
                    margin-bottom: 0.5rem;
                }

                .label {
                    font-size: 1.25rem;
                    text-transform: uppercase;
                    letter-spacing: 0.2em;
                    color: #64748b;
                    font-weight: 600;
                }

                @media (max-width: 600px) {
                    .title {
                        font-size: 2.5rem;
                    }
                    
                    .counter {
                        font-size: 2.5rem;
                    }

                    .counter-container {
                        padding: 1.5rem 2rem;
                        width: 90%;
                    }
                }
            `}</style>
        </div>
    );
}

export default Home;