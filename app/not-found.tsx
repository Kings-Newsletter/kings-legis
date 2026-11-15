import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <h1>Página não encontrada</h1>
      <p className="lead">O endereço pode ter mudado ou a página ainda não existe.</p>
      <p>
        <Link href="/legis">Voltar para o início do Legis</Link>
      </p>
    </>
  );
}
