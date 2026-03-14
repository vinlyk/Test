import SwiftUI

struct QuarantineView: View {
    @ObservedObject var manager: QuarantineManager

    @State private var selection: Set<QuarantineRecord.ID> = []
    @State private var errorAlert: String? = nil
    @State private var confirmDelete: QuarantineRecord? = nil

    var body: some View {
        Group {
            if manager.records.isEmpty {
                emptyState
            } else {
                quarantineTable
            }
        }
        .navigationTitle("Quarantine (\(manager.records.count))")
        .alert("Error", isPresented: Binding(
            get: { errorAlert != nil },
            set: { if !$0 { errorAlert = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorAlert ?? "")
        }
        .confirmationDialog(
            "Permanently Delete File?",
            isPresented: Binding(get: { confirmDelete != nil }, set: { if !$0 { confirmDelete = nil } }),
            titleVisibility: .visible
        ) {
            if let record = confirmDelete {
                Button("Delete Permanently", role: .destructive) {
                    delete(record)
                }
            }
            Button("Cancel", role: .cancel) { confirmDelete = nil }
        } message: {
            Text("This action cannot be undone. The file will be permanently deleted.")
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "lock.shield.fill")
                .font(.system(size: 56))
                .foregroundStyle(.green)
            Text("Quarantine is Empty")
                .font(.title2)
            Text("Files moved to quarantine will appear here.")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Table

    private var quarantineTable: some View {
        Table(manager.records, selection: $selection) {
            TableColumn("File Name") { record in
                VStack(alignment: .leading, spacing: 2) {
                    Text(record.originalFileName)
                        .fontWeight(.medium)
                    Text(record.originalPath)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
            }
            TableColumn("Threat") { record in
                Text(record.threatName)
                    .foregroundStyle(.orange)
                    .font(.callout.monospaced())
            }
            TableColumn("Quarantined") { record in
                Text(record.quarantinedAtFormatted)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            TableColumn("Actions") { record in
                HStack {
                    Button("Restore") {
                        restore(record)
                    }
                    .buttonStyle(.bordered)
                    .help("Restore file to its original location")

                    Button("Delete", role: .destructive) {
                        confirmDelete = record
                    }
                    .buttonStyle(.bordered)
                    .tint(.red)
                    .help("Permanently delete the file")
                }
            }
            .width(180)
        }
    }

    // MARK: - Actions

    private func restore(_ record: QuarantineRecord) {
        do {
            try manager.restore(record: record)
        } catch {
            errorAlert = error.localizedDescription
        }
    }

    private func delete(_ record: QuarantineRecord) {
        do {
            try manager.delete(record: record)
        } catch {
            errorAlert = error.localizedDescription
        }
        confirmDelete = nil
    }
}
