package com.zatiaras.pos.feature.pos.presentation.receipt

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.Store
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zatiaras.pos.core.ui.theme.AppShapes
import com.zatiaras.pos.core.ui.theme.Slate50
import com.zatiaras.pos.core.ui.theme.Brand500
import com.zatiaras.pos.core.ui.theme.Brand600
import com.zatiaras.pos.core.ui.theme.ErrorRed
import com.zatiaras.pos.core.ui.theme.Slate200
import com.zatiaras.pos.core.ui.theme.Slate400
import com.zatiaras.pos.core.ui.theme.Slate500
import com.zatiaras.pos.core.ui.theme.Slate700
import com.zatiaras.pos.core.ui.theme.Slate900
import com.zatiaras.pos.core.ui.util.CurrencyFormatter
import com.zatiaras.pos.feature.pos.R
import com.zatiaras.pos.feature.pos.domain.model.Transaction
import com.zatiaras.pos.feature.pos.domain.model.TransactionItem
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReceiptScreen(
    transaction: Transaction,
    onNavigateBack: () -> Unit,
    onNewTransaction: () -> Unit,
    onPrintReceipt: () -> Unit,
    isPrinting: Boolean = false,
    isPrinterConnected: Boolean = false,
    printerName: String? = null,
    modifier: Modifier = Modifier
) {
    val dateFormatter = SimpleDateFormat("dd MMM yyyy, HH:mm", Locale("id", "ID"))
    val discountCashierName = transaction.extractDiscountCashierName()

    Scaffold(
        modifier = modifier,
        containerColor = Slate50,
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Text(
                        text = stringResource(R.string.pos_receipt_detail_title),
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = Brand600
                        )
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.pos_back),
                            tint = Brand600
                        )
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    scrolledContainerColor = MaterialTheme.colorScheme.background
                )
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Success Header
            item {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(top = 8.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .clip(CircleShape)
                            .background(Brand600),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = null,
                            modifier = Modifier.size(40.dp),
                            tint = MaterialTheme.colorScheme.onPrimary
                        )
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = stringResource(R.string.checkout_success),
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.Bold,
                            color = Brand600
                        )
                    )
                    Text(
                        text = stringResource(R.string.transaction_id, transaction.transactionNumber),
                        style = MaterialTheme.typography.bodyMedium.copy(
                            color = Slate500
                        )
                    )
                }
            }

            // Receipt Paper Effect
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)),
                    shape = AppShapes.L,
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                    border = BorderStroke(1.dp, Slate200.copy(alpha = 0.7f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(24.dp)) {
                        // Store Info
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(
                                imageVector = Icons.Default.Store,
                                contentDescription = null,
                                tint = Brand600,
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                stringResource(R.string.pos_receipt_store_name_default),
                                style = MaterialTheme.typography.titleLarge.copy(
                                    fontWeight = FontWeight.Black,
                                    color = Slate900
                                )
                            )
                            Text(
                                stringResource(R.string.pos_receipt_store_address_default),
                                style = MaterialTheme.typography.bodySmall.copy(color = Slate500),
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                dateFormatter.format(Date(transaction.createdAt)),
                                style = MaterialTheme.typography.bodySmall.copy(color = Slate500)
                            )
                        }

                        Spacer(modifier = Modifier.height(24.dp))
                        GenerateDashedDivider()
                        Spacer(modifier = Modifier.height(24.dp))

                        // Items
                        transaction.items.forEach { item ->
                            ReceiptItemRow(item)
                            Spacer(modifier = Modifier.height(12.dp))
                        }

                        Spacer(modifier = Modifier.height(24.dp))
                        GenerateDashedDivider()
                        Spacer(modifier = Modifier.height(24.dp))

                        // Totals
                        ReceiptTotalRow(stringResource(R.string.pos_history_payment_type), transaction.paymentMethod.displayName)
                        
                        if (transaction.customerName != null) {
                            Spacer(modifier = Modifier.height(8.dp))
                            ReceiptTotalRow(stringResource(R.string.pos_history_customer), transaction.customerName)
                        }
                        
                        Spacer(modifier = Modifier.height(8.dp))
                        ReceiptTotalRow(stringResource(R.string.pos_subtotal), CurrencyFormatter.formatCurrency(transaction.subtotal))
                        
                        if (transaction.discountAmount > 0) {
                            Spacer(modifier = Modifier.height(8.dp))
                            ReceiptTotalRow(
                                stringResource(R.string.pos_receipt_discount_label),
                                stringResource(
                                    R.string.pos_receipt_discount_value,
                                    CurrencyFormatter.formatCurrency(transaction.discountAmount)
                                ),
                                valueColor = ErrorRed
                            )

                            if (!discountCashierName.isNullOrBlank()) {
                                Spacer(modifier = Modifier.height(8.dp))
                                ReceiptTotalRow(
                                    stringResource(R.string.checkout_discount_cashier_name_label),
                                    discountCashierName
                                )
                            }
                        }
                        
                        if (transaction.taxPercent >= 1.0 && transaction.taxAmount > 0) {
                            Spacer(modifier = Modifier.height(8.dp))
                            ReceiptTotalRow(
                                stringResource(R.string.checkout_tax, transaction.taxPercent.toPercentDisplayString()),
                                CurrencyFormatter.formatCurrency(transaction.taxAmount)
                            )
                        }
                        
                        Spacer(modifier = Modifier.height(12.dp))
                        HorizontalDivider(color = Slate50)
                        Spacer(modifier = Modifier.height(12.dp))
                        
                        ReceiptTotalRow(
                            stringResource(R.string.pos_total),
                            CurrencyFormatter.formatCurrency(transaction.grandTotal),
                            isTotal = true
                        )
                    }
                }
            }
            
            // Printer Status if connected
            if (isPrinterConnected) {
                item {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Print,
                            contentDescription = null,
                            tint = Slate500,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = stringResource(
                                R.string.pos_receipt_printer,
                                printerName ?: stringResource(R.string.pos_receipt_printer_default)
                            ),
                            style = MaterialTheme.typography.bodySmall.copy(color = Slate500)
                        )
                    }
                }
            }

            // Action Buttons
            item {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Button(
                        onClick = onPrintReceipt,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp),
                        shape = AppShapes.L,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Brand600
                        ),
                        elevation = ButtonDefaults.buttonElevation(defaultElevation = 2.dp),
                        enabled = !isPrinting
                    ) {
                        if (isPrinting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = MaterialTheme.colorScheme.onPrimary,
                                strokeWidth = 2.dp
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(stringResource(R.string.pos_receipt_printing), fontWeight = FontWeight.Bold)
                        } else {
                            Icon(Icons.Default.Print, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(stringResource(R.string.checkout_print_receipt), fontWeight = FontWeight.Bold)
                        }
                    }

                    OutlinedButton(
                        onClick = onNewTransaction,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp),
                        shape = AppShapes.L,
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = Brand600
                        ),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Brand600)
                    ) {
                        Icon(Icons.Default.Receipt, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(stringResource(R.string.checkout_new_transaction), fontWeight = FontWeight.Bold)
                    }
                }
            }
            
             // Bottom Spacer
            item {
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

private fun Transaction.extractDiscountCashierName(): String? {
    val marker = "[Diskon oleh Kasir:"
    val source = notes ?: return null
    val start = source.indexOf(marker)
    if (start == -1) return null
    val end = source.indexOf(']', startIndex = start)
    if (end == -1) return null
    return source.substring(start + marker.length, end).trim().ifBlank { null }
}

private fun Transaction.getNotesWithoutDiscountCashierMeta(): String? {
    val source = notes ?: return null
    val marker = "[Diskon oleh Kasir:"
    val start = source.indexOf(marker)
    if (start == -1) return source.ifBlank { null }
    val end = source.indexOf(']', startIndex = start)
    if (end == -1) return source.ifBlank { null }

    val cleaned = (source.removeRange(start, end + 1))
        .replace("\n\n", "\n")
        .trim()

    return cleaned.ifBlank { null }
}

@Composable
fun ReceiptItemRow(item: TransactionItem) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.productName,
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontWeight = FontWeight.Medium,
                    color = Slate900
                )
            )
            if (item.quantity > 1) {
                Text(
                    text = stringResource(
                        R.string.pos_receipt_item_qty_price,
                        item.quantity,
                        CurrencyFormatter.formatCurrency(item.productPrice)
                    ),
                    style = MaterialTheme.typography.bodySmall.copy(
                        color = Slate500
                    )
                )
            }
            if (!item.notes.isNullOrBlank()) {
                Text(
                   text = "${stringResource(R.string.pos_receipt_notes)} ${item.notes}",
                   style = MaterialTheme.typography.labelSmall.copy(
                       color = Slate500,
                       fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                   )
                )
            }
        }
        Text(
            text = CurrencyFormatter.formatCurrency(item.subtotal),
            style = MaterialTheme.typography.bodyMedium.copy(
                fontWeight = FontWeight.SemiBold,
                color = Slate900
            )
        )
    }
}

@Composable
fun ReceiptTotalRow(
    label: String, 
    value: String, 
    isTotal: Boolean = false,
    valueColor: Color? = null
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = if (isTotal) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium,
            fontWeight = if (isTotal) FontWeight.Bold else FontWeight.Normal,
            color = if (isTotal) Slate900 else Slate500
        )
        Text(
            text = value,
            style = if (isTotal) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium,
            fontWeight = if (isTotal) FontWeight.Bold else FontWeight.Medium,
            color = valueColor ?: (if (isTotal) Brand600 else Slate900)
        )
    }
}

@Composable
fun GenerateDashedDivider(
    color: Color = Slate200,
    thickness: Dp = 1.dp,
    interval: Float = 10f
) {
    Canvas(modifier = Modifier
        .fillMaxWidth()
        .height(thickness)
    ) {
        drawLine(
            color = color,
            start = Offset(0f, 0f),
            end = Offset(size.width, 0f),
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(interval, interval), 0f),
            strokeWidth = thickness.toPx()
        )
    }
}

private fun Double.toPercentDisplayString(): String {
    return this.toBigDecimal().stripTrailingZeros().toPlainString()
}

