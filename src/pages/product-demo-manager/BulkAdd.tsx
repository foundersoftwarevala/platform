import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const BulkAdd = () => {
  const [uploadType, setUploadType] = useState<"products" | "demos" | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) {
      setUploadedFile(file);
      toast.success("CSV file uploaded", { description: file.name });
    } else {
      toast.error("Invalid file", { description: "Please upload a CSV file" });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      toast.success("CSV file selected", { description: file.name });
    }
  };

  const handleUpload = () => {
    if (!uploadedFile || !uploadType) return;
    
    // Simulate validation and upload
    toast.info("Validating CSV...");
    setTimeout(() => {
      toast.success("Bulk upload completed!", {
        description: `${uploadType === "products" ? "Products" : "Demos"} added successfully`
      });
      setUploadedFile(null);
      setUploadType(null);
    }, 2000);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Upload className="w-6 h-6 text-emerald-400" />
          Bulk Add
        </h1>
        <p className="text-slate-400 text-sm">Upload CSV files to add multiple products or demos</p>
      </div>

      {/* Warning Banner */}
      <div className="p-4 bg-amber-900/20 border border-amber-500/30 rounded-lg flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-amber-400 font-medium">Bulk Upload Rules</p>
          <ul className="text-xs text-amber-400/70 mt-1 space-y-1">
            <li>• CSV validated before insert</li>
            <li>• No overwrite allowed</li>
            <li>• Duplicates blocked</li>
            <li>• All records become immutable after upload</li>
          </ul>
        </div>
      </div>

      {/* Upload Type Selection */}
      {!uploadType && (
        <div className="grid grid-cols-2 gap-4">
          <Card
            className="bg-slate-900/50 border-slate-700/50 cursor-pointer hover:border-violet-500/50 transition-colors"
            onClick={() => setUploadType("products")}
          >
            <CardContent className="p-6 text-center">
              <FileSpreadsheet className="w-12 h-12 text-violet-400 mx-auto mb-3" />
              <p className="text-white font-medium">Bulk Add Products</p>
              <p className="text-xs text-slate-400 mt-1">Upload products CSV</p>
            </CardContent>
          </Card>

          <Card
            className="bg-slate-900/50 border-slate-700/50 cursor-pointer hover:border-blue-500/50 transition-colors"
            onClick={() => setUploadType("demos")}
          >
            <CardContent className="p-6 text-center">
              <FileSpreadsheet className="w-12 h-12 text-blue-400 mx-auto mb-3" />
              <p className="text-white font-medium">Bulk Add Demos</p>
              <p className="text-xs text-slate-400 mt-1">Upload demos CSV</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upload Area */}
      {uploadType && (
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              Upload {uploadType === "products" ? "Products" : "Demos"} CSV
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                isDragging ? "border-emerald-500 bg-emerald-500/10" : "border-slate-700 hover:border-slate-600",
                uploadedFile && "border-emerald-500 bg-emerald-500/10"
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              {uploadedFile ? (
                <div className="space-y-2">
                  <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
                  <p className="text-white font-medium">{uploadedFile.name}</p>
                  <p className="text-xs text-slate-400">{(uploadedFile.size / 1024).toFixed(2)} KB</p>
                </div>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <p className="text-white">Drag & drop your CSV file here</p>
                  <p className="text-xs text-slate-400 mt-1">or click to browse</p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </>
              )}
            </div>

            {/* CSV Template Info */}
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <p className="text-sm text-slate-300 font-medium mb-2">Required CSV Columns:</p>
              {uploadType === "products" ? (
                <p className="text-xs text-slate-400">product_name, category, pricing_model, lifetime_price, description</p>
              ) : (
                <p className="text-xs text-slate-400">title, category, demo_type, url, description</p>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => { setUploadType(null); setUploadedFile(null); }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!uploadedFile}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload & Process
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BulkAdd;
