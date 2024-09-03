function generateInvoice() {
    // Obtener valores del formulario
    const issuerCompanyName = document.getElementById('issuerCompanyName').value;
    const issuerCompanyAddress = document.getElementById('issuerCompanyAddress').value;
    const issuerCompanyPhone = document.getElementById('issuerCompanyPhone').value;
    const issuerCompanyEmail = document.getElementById('issuerCompanyEmail').value;
    
    const companyName = document.getElementById('companyName').value;
    const issuerName = document.getElementById('issuerName').value;
    const description = document.getElementById('description').value;
    const quantity = parseFloat(document.getElementById('quantity').value);
    const unitPrice = parseFloat(document.getElementById('unitPrice').value);

    // Calcular el total
    const total = (quantity * unitPrice).toFixed(2);

    // Mostrar la factura
    document.getElementById('invoiceIssuerCompanyName').textContent = `Empresa Emisora: ${issuerCompanyName}`;
    document.getElementById('invoiceIssuerCompanyAddress').textContent = `Dirección: ${issuerCompanyAddress}`;
    document.getElementById('invoiceIssuerCompanyPhone').textContent = `Teléfono: ${issuerCompanyPhone}`;
    document.getElementById('invoiceIssuerCompanyEmail').textContent = `Email: ${issuerCompanyEmail}`;

    document.getElementById('invoiceCompany').textContent = `Empresa Cliente: ${companyName}`;
    document.getElementById('invoiceIssuer').textContent = `Emisor: ${issuerName}`;
    document.getElementById('invoiceDescription').textContent = `Descripción: ${description}`;
    document.getElementById('invoiceQuantity').textContent = `Cantidad: ${quantity}`;
    document.getElementById('invoiceUnitPrice').textContent = `Precio Unitario: $${unitPrice.toFixed(2)}`;
    document.getElementById('invoiceTotal').textContent = `Total: $${total}`;

    document.getElementById('invoiceContainer').style.display = 'block';
}

function printInvoice() {
    const printContent = document.getElementById('invoiceContainer').innerHTML;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
}
