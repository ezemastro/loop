import Layout from "@/components/Layout";

export default function Home() {
  return (
    <Layout>
      {/* Login and register buttons */}
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <h1 className="text-3xl font-bold mb-6">Admin Client</h1>
        <div className="space-x-4">
          <a href="/login" className="bg-blue-500 text-white px-4 py-2 rounded">
            Login
          </a>
          <a
            href="/register"
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Register
          </a>
        </div>
      </div>
    </Layout>
  );
}
